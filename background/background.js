/**
 * 京东智能购物助手 - 背景脚本 (Service Worker)
 * 负责API请求处理、数据存储和插件状态管理
 */

// 导入API模块
import { analyzeProduct, getAnalysisSource, initApiConfig, setApiConfig, sendChatMessage } from '../utils/api.js';

// 存储商品分析数据的缓存
const productCache = new Map();

// 初始化扩展程序
const initializeExtension = async () => {
  console.log('京东智能购物助手 - 正在初始化...');
  
  try {
    // 初始化API配置
    const success = await initApiConfig();
    
    if (!success) {
      // 如果.env加载失败，尝试从storage中加载
      try {
        const { apiConfig } = await chrome.storage.local.get('apiConfig');
        if (apiConfig) {
          setApiConfig(apiConfig);
          console.log('已从storage加载API配置');
        }
      } catch (storageError) {
        console.error('从storage加载API配置失败:', storageError);
      }
    }
  } catch (error) {
    console.error('初始化API配置失败:', error);
  }
  
  // 显示欢迎通知
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../assets/icon128.png',
    title: '京东智能购物助手已启动',
    message: '访问京东商品页面时，将自动分析价格、评论及卖家信息。',
    priority: 2
  });
};

// 清理缓存数据
const cleanupCache = () => {
  // 保持缓存不超过100项
  if (productCache.size > 100) {
    // 转换为数组，按时间戳排序，并删除最老的项
    const cacheEntries = Array.from(productCache.entries());
    cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // 删除最老的20个项目
    const toDelete = cacheEntries.slice(0, 20);
    toDelete.forEach(([key]) => productCache.delete(key));
    
    console.log(`已清理${toDelete.length}项缓存数据`);
  }
};

// 分析商品
const handleAnalyzeProduct = async (productData, sendResponse) => {
  try {
    const { product } = productData;
    const productId = product.id;
    
    // 检查缓存
    if (productCache.has(productId)) {
      console.log(`从缓存获取商品数据: ${productId}`);
      sendResponse({ success: true, ...productCache.get(productId) });
      return;
    }
    
    console.log(`分析商品: ${productId}`);
    
    // 调用API分析商品
    const result = await analyzeProduct(productData);
    
    if (result.success) {
      // 缓存结果
      productCache.set(productId, {
        ...result,
        timestamp: new Date().toISOString()
      });
      
      // 清理缓存
      cleanupCache();
    }
    
    // 发送响应
    sendResponse(result);
  } catch (error) {
    console.error('处理商品分析时出错:', error);
    sendResponse({ 
      success: false,
      error: error.message || '分析商品时出错'
    });
  }
};

// 获取商品分析结果
const handleGetProductData = (tabId, sendResponse) => {
  try {
    // 获取标签页上的商品数据
    chrome.tabs.sendMessage(tabId, { action: 'getProductData' }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('获取商品数据失败:', chrome.runtime.lastError);
        sendResponse({ success: false, error: '无法从页面获取数据' });
        return;
      }
      
      if (response && response.success && response.data) {
        const { product } = response.data;
        
        // 检查缓存
        if (productCache.has(product.id)) {
          sendResponse({ 
            success: true, 
            data: productCache.get(product.id)
          });
        } else {
          sendResponse({ 
            success: false, 
            error: '尚未分析此商品'
          });
        }
      } else {
        sendResponse({ 
          success: false, 
          error: '未找到商品数据'
        });
      }
    });
  } catch (error) {
    console.error('获取商品数据时出错:', error);
    sendResponse({ 
      success: false, 
      error: error.message || '获取数据时出错'
    });
  }
  
  // 返回true表示异步响应
  return true;
};

// 获取决策溯源信息
const handleGetAnalysisSource = async (tabId, sendResponse) => {
  try {
    // 获取标签页上的商品数据
    chrome.tabs.sendMessage(tabId, { action: 'getProductData' }, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('获取商品数据失败:', chrome.runtime.lastError);
        sendResponse({ success: false, error: '无法从页面获取数据' });
        return;
      }
      
      if (response && response.success && response.data) {
        const { product } = response.data;
        
        // 调用API获取决策溯源
        const result = await getAnalysisSource(product.id);
        sendResponse(result);
      } else {
        sendResponse({ 
          success: false, 
          error: '未找到商品数据'
        });
      }
    });
  } catch (error) {
    console.error('获取决策溯源时出错:', error);
    sendResponse({ 
      success: false, 
      error: error.message || '获取决策溯源时出错'
    });
  }
  
  // 返回true表示异步响应
  return true;
};

// 打开溯源窗口
const handleOpenSourceDialog = (sendResponse) => {
  chrome.windows.create({
    url: chrome.runtime.getURL('source/source.html'),
    type: 'popup',
    width: 800,
    height: 600
  });
  
  if (sendResponse) {
    sendResponse({ success: true });
  }
};

// 处理聊天消息
const handleChatMessage = async (message, sendResponse) => {
  try {
    const response = await sendChatMessage(message);
    sendResponse(response);
  } catch (error) {
    console.error('处理聊天消息失败:', error);
    sendResponse({
      success: false,
      error: error.message || '处理消息时出错',
      answer: '抱歉，处理消息时出现错误。'
    });
  }
};

// 保存API配置
const handleSaveApiConfig = async (config, sendResponse) => {
  try {
    // 验证配置
    if (!config.apiUrl) {
      sendResponse({ success: false, error: '请提供有效的API URL' });
      return;
    }
    
    // 更新API配置
    setApiConfig(config);
    
    // 保存到storage
    await chrome.storage.local.set({ apiConfig: config });
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('保存API配置失败:', error);
    sendResponse({ 
      success: false, 
      error: error.message || '保存配置失败'
    });
  }
};

// 监听来自内容脚本和弹出窗口的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('收到消息:', message.action);
  
  switch (message.action) {
    case 'sendChatMessage':
      handleChatMessage(message.message, sendResponse);
      return true; // 异步响应
      
    case 'analyzeProduct':
      handleAnalyzeProduct(message.data, sendResponse);
      return true; // 异步响应
      
    case 'getProductData':
      return handleGetProductData(message.tabId, sendResponse);
      
    case 'getAnalysisSource':
      return handleGetAnalysisSource(message.tabId, sendResponse);
      
    case 'openSourceDialog':
      handleOpenSourceDialog(sendResponse);
      return true; // 异步响应
      
    case 'saveApiConfig':
      handleSaveApiConfig(message.config, sendResponse);
      return true; // 异步响应
      
    default:
      console.log('未知消息类型:', message.action);
      sendResponse({ success: false, error: '未知消息类型' });
  }
});

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 当页面加载完成时，检查是否是京东商品页面
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('item.jd.com')) {
    console.log('检测到京东商品页面加载完成:', tab.url);
    
    // 可以在这里添加额外的逻辑，比如自动分析商品
  }
});

// 初始化扩展程序
initializeExtension(); 