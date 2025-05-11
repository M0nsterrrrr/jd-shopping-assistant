// ========== API配置 ==========
const DEFAULT_CONFIG = {
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'qwen/qwen3-4b:free',
  apiKey: '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',
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'X-Title': 'JD-Shopping-Assistant'
  }
};

// 存储API配置
let apiConfig = { ...DEFAULT_CONFIG };

/**
 * 带超时的fetch
 * @param {string} url - 请求URL
 * @param {Object} options - fetch选项
 * @param {number} timeout - 超时时间(ms)
 * @returns {Promise} fetch响应
 */
const fetchWithTimeout = (url, options, timeout) => {
  // 确保headers包含认证信息
  const requestHeaders = {
    ...apiConfig.headers,
    ...(options.headers || {}),
    'Authorization': `Bearer ${apiConfig.apiKey}`
  };

  const fetchOptions = {
    ...options,
    headers: requestHeaders
  };

  return Promise.race([
    fetch(url, fetchOptions),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('请求超时')), timeout)
    )
  ]);
};

/**
 * 处理聊天消息的发送和接收
 * @param {string} userMessage - 用户发送的消息
 * @returns {Promise} 返回聊天回复
 */
const sendChatMessage = async (userMessage) => {
  try {
    const response = await fetchWithTimeout(
      apiConfig.apiUrl,
      {
        method: 'POST',
        body: JSON.stringify({
          model: apiConfig.model,
          messages: [
            {
              role: 'system',
              content: '你是一个乐于助人的京东购物助手。'
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.7,
        })
      },
      apiConfig.timeout
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API请求失败: ${response.status} ${response.statusText} - ${errorData}`);
    }
    
    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return { success: true, answer: data.choices[0].message.content };
    } else {
      throw new Error('API响应格式不正确或内容为空');
    }

  } catch (error) {
    console.error('发送聊天消息失败:', error);
    return {
      success: false,
      error: error.message || '请求失败',
      answer: '抱歉，我暂时无法回复。'
    };
  }
};

// 初始化 UI 函数
const initializeUI = (elements) => {
  console.log('开始初始化UI');
  
  // 确保容器可见
  document.querySelector('.container').style.display = 'flex';
  
  if (elements.statusIndicator && elements.statusText) {
    console.log('设置状态指示器');
    elements.statusIndicator.className = 'status-indicator';
    elements.statusText.textContent = '加载中...';
  }
  
  if (elements.productInfo) {
    console.log('设置产品信息');
    elements.productInfo.innerHTML = '<p>正在加载商品信息...</p>';
  }

  // 设置聊天功能
  if (elements.chatInput && elements.chatSendBtn && elements.chatHistory) {
    console.log('正在设置聊天功能...');
    
    elements.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        console.log('检测到回车键按下');
        elements.chatSendBtn.click();
      }
    });

    elements.chatSendBtn.addEventListener('click', async () => {
      console.log('发送按钮被点击');
      const userMsg = elements.chatInput.value.trim();
      console.log('用户输入:', userMsg);
      
      if (!userMsg) return;
      
      elements.chatInput.value = '';
      elements.chatHistory.innerHTML += `<div style="color:#1677ff;margin-bottom:2px;">我：${userMsg}</div>`;
      elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
      
      elements.chatHistory.innerHTML += `<div id="aiThinking" style="color:#aaa;">助手：正在思考...</div>`;
      elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;

      try {
        console.log('开始调用API...');
        const res = await sendChatMessage(userMsg);
        console.log('API响应:', res);
        
        document.getElementById('aiThinking')?.remove();
        elements.chatHistory.innerHTML += `<div style="color:#333;margin-bottom:6px;">助手：${res.success ? res.answer : (res.error || '出错了')}</div>`;
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
      } catch (err) {
        console.error('聊天出错:', err);
        document.getElementById('aiThinking')?.remove();
        elements.chatHistory.innerHTML += `<div style="color:#ff4d4f;margin-bottom:6px;">助手：网络或服务异常</div>`;
        elements.chatHistory.scrollTop = elements.chatHistory.scrollHeight;
      }
    });
    
    console.log('聊天功能设置完成');
  } else {
    console.warn('找不到聊天相关的DOM元素');
  }
};

// 获取当前标签页信息
const getCurrentTab = async () => {
  try {
    const queryOptions = { active: true, currentWindow: true };
    const [tab] = await chrome.tabs.query(queryOptions);
    return tab;
  } catch (error) {
    console.error('获取标签页失败:', error);
    return null;
  }
};

// 等待 DOM 完全加载
window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ContentLoaded 事件触发');
  
  // 确保容器可见
  const container = document.querySelector('.container');
  if (container) {
    container.style.display = 'flex';
    container.style.visibility = 'visible';
  }
  
  // 延迟一点执行初始化
  setTimeout(async () => {
    try {
      console.log('开始获取DOM元素');
      
      // 获取所有需要的 DOM 元素
      const elements = {
        statusIndicator: document.getElementById('statusIndicator'),
        statusText: document.getElementById('statusText'),
        productInfo: document.getElementById('productInfo'),
        priceChart: document.getElementById('priceChart'),
        priceSummary: document.getElementById('priceSummary'),
        reviewScore: document.getElementById('reviewScore'),
        reviewSummary: document.getElementById('reviewSummary'),
        sellerScore: document.getElementById('sellerScore'),
        sellerSummary: document.getElementById('sellerSummary'),
        alternativeProducts: document.getElementById('alternativeProducts'),
        sourceButton: document.getElementById('sourceButton'),
        updateTime: document.getElementById('updateTime'),
        chatHistory: document.getElementById('chatHistory'),
        chatInput: document.getElementById('chatInput'),
        chatSendBtn: document.getElementById('chatSendBtn')
      };

      // 检查DOM元素是否正确获取
      console.log('DOM 元素状态:', elements);

      // 初始化界面
      initializeUI(elements);

      // 更新状态函数
      const updateStatus = (isOnline) => {
        if (elements.statusIndicator) {
          elements.statusIndicator.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
        }
        if (elements.statusText) {
          elements.statusText.textContent = isOnline ? '已连接' : '离线模式';
        }
      };

      // 获取当前标签页
      const tab = await getCurrentTab();
      if (!tab) {
        updateStatus(false);
        if (elements.productInfo) {
          elements.productInfo.innerHTML = '<p>无法获取当前标签页信息</p>';
        }
        return;
      }

      // 检查是否在京东商品页面
      const isJdProductPage = tab.url && tab.url.includes('jd.com/item');
      if (!isJdProductPage) {
        updateStatus(false);
        if (elements.productInfo) {
          elements.productInfo.innerHTML = '<p>请访问京东商品页面以获取分析</p>';
        }
        return;
      }

      // 从背景脚本获取数据
      chrome.runtime.sendMessage({ action: 'getProductData', tabId: tab.id }, (response) => {
        if (response && response.success && response.data) {
          const { product, priceData, reviewData, sellerData, alternatives, timestamp } = response.data;
          
          if (elements.productInfo && product) {
            displayProductInfo(product);
          }
          if (elements.priceSummary && priceData) {
            displayPriceAnalysis(priceData);
          }
          if (elements.reviewScore && reviewData) {
            displayReviewAnalysis(reviewData);
          }
          if (elements.sellerScore && sellerData) {
            displaySellerAnalysis(sellerData);
          }
          if (elements.alternativeProducts && alternatives) {
            displayAlternatives(alternatives);
          }
          
          updateStatus(true);
        } else {
          updateStatus(false);
          if (elements.productInfo) {
            elements.productInfo.innerHTML = '<p>数据加载失败，请刷新页面重试</p>';
          }
        }
      });

    } catch (error) {
      console.error('初始化出错:', error);
      // 显示错误信息
      const productInfo = document.getElementById('productInfo');
      if (productInfo) {
        productInfo.innerHTML = `<p style="color: #ff4d4f;">初始化失败: ${error.message}</p>`;
      }
    }
  }, 100); // 延迟 100ms 执行
});

// 显示产品信息
const displayProductInfo = (product) => {
  if (!product) {
    document.getElementById('productInfo').innerHTML = '<p>请访问京东商品页面以获取分析</p>';
    return;
  }

  document.getElementById('productInfo').innerHTML = `
    <div class="product-header">
      <img src="${product.image}" alt="${product.title}" class="product-image">
      <div class="product-title">${product.title}</div>
    </div>
    <div class="product-details">
      <div class="product-price">￥${product.price}</div>
      <div class="product-id">商品ID: ${product.id}</div>
    </div>
  `;
};

// 显示价格分析
const displayPriceAnalysis = (priceData) => {
  if (!priceData) {
    document.getElementById('priceSummary').textContent = '暂无价格数据';
    return;
  }

  document.getElementById('priceSummary').innerHTML = `
    <p>历史最低: <strong>￥${priceData.lowest}</strong></p>
    <p>历史最高: <strong>￥${priceData.highest}</strong></p>
    <p>当前价格: <strong>￥${priceData.current}</strong></p>
    <p>建议: <strong>${priceData.recommendation}</strong></p>
  `;
};

// 显示评论分析
const displayReviewAnalysis = (reviewData) => {
  if (!reviewData) {
    document.getElementById('reviewScore').textContent = 'N/A';
    document.getElementById('reviewSummary').textContent = '暂无评论数据';
    return;
  }

  document.getElementById('reviewScore').textContent = reviewData.score.toFixed(1);
  
  const scoreColor = reviewData.score >= 7 ? '#52c41a' : 
                     reviewData.score >= 5 ? '#faad14' : '#ff4d4f';
  document.getElementById('reviewScore').style.color = scoreColor;

  document.getElementById('reviewSummary').innerHTML = `
    <p>真实评论率: <strong>${reviewData.authenticity}%</strong></p>
    <p>总评论数: <strong>${reviewData.total}</strong></p>
    <p>分析: <strong>${reviewData.summary}</strong></p>
  `;
};

// 显示卖家分析
const displaySellerAnalysis = (sellerData) => {
  if (!sellerData) {
    document.getElementById('sellerScore').textContent = 'N/A';
    document.getElementById('sellerSummary').textContent = '暂无卖家数据';
    return;
  }

  document.getElementById('sellerScore').textContent = sellerData.score.toFixed(1);
  
  const scoreColor = sellerData.score >= 7 ? '#52c41a' : 
                    sellerData.score >= 5 ? '#faad14' : '#ff4d4f';
  document.getElementById('sellerScore').style.color = scoreColor;

  document.getElementById('sellerSummary').innerHTML = `
    <p>店铺评分: <strong>${sellerData.shopScore}</strong></p>
    <p>售后服务: <strong>${sellerData.service}</strong></p>
    <p>风险等级: <strong>${sellerData.riskLevel}</strong></p>
  `;
};

// 显示比价推荐
const displayAlternatives = (alternatives) => {
  if (!alternatives || alternatives.length === 0) {
    document.getElementById('alternativeProducts').innerHTML = '<p>暂无可比价商品</p>';
    return;
  }

  document.getElementById('alternativeProducts').innerHTML = alternatives.map(item => `
    <div class="alternative-product">
      <img src="${item.image}" alt="${item.title}" class="alt-product-image">
      <div class="alt-product-title">${item.title.substring(0, 20)}...</div>
      <div class="alt-product-price">￥${item.price}</div>
    </div>
  `).join('');
};

// 打开溯源窗口
const openSourceDialog = (analysisData) => {
  chrome.windows.create({
    url: chrome.runtime.getURL('source/source.html'),
    type: 'popup',
    width: 800,
    height: 600
  });
};

// 设置溯源按钮事件
document.getElementById('sourceButton').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getAnalysisSource', tabId: tab.id }, (response) => {
    if (response.success && response.data) {
      openSourceDialog(response.data);
    } else {
      alert('无法获取决策溯源数据');
    }
  });
}); 