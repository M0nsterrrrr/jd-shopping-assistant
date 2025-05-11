/**
 * 京东智能购物助手 - 内容脚本
 * 负责在京东商品页面提取数据、注入UI元素并与背景脚本通信
 */

// 在 content.js 文件的最开头
console.log('[JD Assistant] content.js loaded');

// 全局变量存储商品数据
let productData = null;

// ========== 数据提取功能 ==========

// 从页面提取商品ID
const extractProductId = () => {
  // 从URL中提取商品ID
  const urlMatch = window.location.href.match(/item\.jd\.com\/(\d+)\.html/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  // 从页面元素中提取
  const skuIdElement = document.querySelector('input[name="skuid"]');
  if (skuIdElement && skuIdElement.value) {
    return skuIdElement.value;
  }
  
  return null;
};

// 从页面提取商品信息
const extractProductInfo = () => {
  const productId = extractProductId();
  if (!productId) {
    console.error('无法提取商品ID');
    return null;
  }
  
  // 提取商品标题
  const titleElement = document.querySelector('.sku-name');
  const title = titleElement ? titleElement.textContent.trim() : '未知商品';
  
  // 提取商品价格
  let price = '未知';
  const priceElement = document.querySelector('.p-price .price, #jd-price');
  if (priceElement) {
    price = priceElement.textContent.trim().replace('￥', '');
  }
  
  // 提取商品图片
  let image = '';
  const imageElement = document.querySelector('#spec-img, #spec-n1 img');
  if (imageElement && imageElement.src) {
    image = imageElement.src;
  }
  
  return {
    id: productId,
    title,
    price,
    image,
    url: window.location.href
  };
};

// 提取评论数据
const extractReviewData = async () => {
  const productId = extractProductId();
  if (!productId) return null;
  
  // 尝试从评论区域提取评论数量
  let totalReviews = 0;
  const commentCountElement = document.querySelector('#comment-count, .count');
  if (commentCountElement) {
    const countText = commentCountElement.textContent.trim();
    const match = countText.match(/\d+/);
    if (match) {
      totalReviews = parseInt(match[0], 10);
    }
  }
  
  return {
    productId,
    totalReviews,
    // 注意：详细评论数据可能需要额外的API请求或异步加载
  };
};

// 提取卖家信息
const extractSellerInfo = () => {
  // 提取卖家名称
  let sellerName = '未知卖家';
  const sellerElement = document.querySelector('#shop-name a, .shopName a');
  if (sellerElement) {
    sellerName = sellerElement.textContent.trim();
  }
  
  // 提取卖家评分
  let shopScore = 0;
  const scoreElements = document.querySelectorAll('.score-parts .score-detail');
  if (scoreElements.length > 0) {
    // 尝试获取评分
    shopScore = Array.from(scoreElements).reduce((sum, el) => {
      const scoreText = el.textContent.trim();
      const match = scoreText.match(/[\d.]+/);
      return sum + (match ? parseFloat(match[0]) : 0);
    }, 0) / scoreElements.length;
  }
  
  return {
    sellerName,
    shopScore: shopScore.toFixed(1),
    isJdSelf: sellerName.includes('京东自营')
  };
};

// ========== UI 交互功能 ==========

// 创建分析面板
const createAnalysisPanel = () => {
  console.log('[JD Assistant] createAnalysisPanel called');
  const panelContainer = document.createElement('div');
  panelContainer.className = 'jd-assistant-panel';

  console.log('[JD Assistant] About to set innerHTML for panelContainer');
  panelContainer.innerHTML = `
    <div class="panel-header">
      <h3>京东智能购物助手</h3>
      <button class="panel-close">×</button>
    </div>
    <div class="panel-content">
      <div class="panel-section loading">
        <div class="loading-spinner"></div>
        <p>正在分析商品数据...</p>
      </div>
    </div>
    <div id="jd-assistant-chat-section" class="assistant-section">
      <h3>智能对话</h3>
      <div id="chat-messages-container">
      </div>
      <div id="chat-input-container">
        <textarea id="chat-input" placeholder="在此输入您的问题..."></textarea>
        <button id="send-chat-button">发送</button>
      </div>
    </div>
  `;
  console.log('[JD Assistant] innerHTML set. panelContainer HTML:', panelContainer.innerHTML);
  
  document.body.appendChild(panelContainer);
  console.log('[JD Assistant] panelContainer appended to body');
  
  const closeButton = panelContainer.querySelector('.panel-close');
  closeButton.addEventListener('click', () => {
    panelContainer.classList.add('panel-hidden');
  });

  initChatFeatures(panelContainer);
  
  return panelContainer;
};

// 添加聊天功能初始化函数
const initChatFeatures = (panel) => {
  console.log('[JD Assistant] initChatFeatures called with panel:', panel);
  
  const sendButton = panel.querySelector('#send-chat-button');
  const chatInput = panel.querySelector('#chat-input');
  const messagesContainer = panel.querySelector('#chat-messages-container');

  // 发送消息处理函数
  const handleSendMessage = async () => {
    const messageText = chatInput.value.trim();
    if (messageText === '') return;

    // 显示用户消息
    displayMessage(messageText, 'user');
    chatInput.value = '';

    try {
      // 发送消息到后端并获取回复
      const response = await chrome.runtime.sendMessage({
        action: 'sendChatMessage',
        message: messageText
      });

      if (response && response.success) {
        displayMessage(response.answer, 'bot');
      } else {
        displayMessage('抱歉，我暂时无法回复。', 'bot');
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      displayMessage('抱歉，发送消息时出现错误。', 'bot');
    }
  };

  // 显示消息的函数
  const displayMessage = (text, type) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${type}-message`);
    messageElement.textContent = text;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };

  // 添加事件监听
  sendButton.addEventListener('click', handleSendMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });
};

// 更新分析面板内容
const updateAnalysisPanel = (panel, data) => {
  const panelContent = panel.querySelector('.panel-content');
  
  if (!data || !data.success) {
    panelContent.innerHTML = `
      <div class="panel-section error">
        <p>分析失败，请稍后重试</p>
      </div>
    `;
    return;
  }
  
  const { priceData, reviewData, sellerData, alternatives } = data;
  
  // 清空加载状态
  panelContent.innerHTML = '';
  
  // 添加价格分析
  if (priceData) {
    const priceSection = document.createElement('div');
    priceSection.className = 'panel-section';
    priceSection.innerHTML = `
      <h4>价格分析</h4>
      <div class="price-trend">
        <div class="price-chart" id="priceChartContainer"></div>
        <div class="price-summary">
          <p>历史最低: <strong>￥${priceData.lowest}</strong></p>
          <p>历史最高: <strong>￥${priceData.highest}</strong></p>
          <p>当前: <strong>￥${priceData.current}</strong></p>
          <p class="price-recommendation">${priceData.recommendation}</p>
        </div>
      </div>
    `;
    panelContent.appendChild(priceSection);
  }
  
  // 添加评论分析
  if (reviewData) {
    const reviewSection = document.createElement('div');
    reviewSection.className = 'panel-section';
    reviewSection.innerHTML = `
      <h4>评论分析</h4>
      <div class="review-analysis">
        <div class="review-score">可信度: <strong>${reviewData.score.toFixed(1)}</strong></div>
        <p>真实评论率: <strong>${reviewData.authenticity}%</strong></p>
        <p>${reviewData.summary}</p>
      </div>
    `;
    panelContent.appendChild(reviewSection);
  }
  
  // 添加卖家分析
  if (sellerData) {
    const sellerSection = document.createElement('div');
    sellerSection.className = 'panel-section';
    sellerSection.innerHTML = `
      <h4>卖家评估</h4>
      <div class="seller-analysis">
        <p>信用评分: <strong>${sellerData.score.toFixed(1)}</strong></p>
        <p>风险等级: <strong class="risk-level ${sellerData.riskLevel.toLowerCase()}">${sellerData.riskLevel}</strong></p>
      </div>
    `;
    panelContent.appendChild(sellerSection);
  }
  
  // 添加比价推荐
  if (alternatives && alternatives.length > 0) {
    const alternativesSection = document.createElement('div');
    alternativesSection.className = 'panel-section';
    alternativesSection.innerHTML = `
      <h4>比价推荐</h4>
      <div class="alternatives-container"></div>
    `;
    
    const container = alternativesSection.querySelector('.alternatives-container');
    alternatives.forEach(item => {
      const productCard = document.createElement('div');
      productCard.className = 'alternative-product';
      productCard.innerHTML = `
        <img src="${item.image}" alt="${item.title}">
        <div class="alt-title">${item.title.substring(0, 20)}...</div>
        <div class="alt-price">￥${item.price}</div>
      `;
      
      // 添加点击事件
      productCard.addEventListener('click', () => {
        window.open(item.url, '_blank');
      });
      
      container.appendChild(productCard);
    });
    
    panelContent.appendChild(alternativesSection);
  }
  
  // 添加溯源按钮
  const sourceSection = document.createElement('div');
  sourceSection.className = 'panel-footer';
  sourceSection.innerHTML = `
    <button class="source-button">查看决策依据</button>
  `;
  
  // 添加溯源按钮事件
  const sourceButton = sourceSection.querySelector('.source-button');
  sourceButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSourceDialog' });
  });
  
  panelContent.appendChild(sourceSection);
};

// 添加悬浮按钮
const addFloatingButton = () => {
  const button = document.createElement('div');
  button.className = 'jd-assistant-button';
  button.innerHTML = `<div class="button-icon">AI</div>`;
  
  // 添加点击事件
  button.addEventListener('click', () => {
    const panel = document.querySelector('.jd-assistant-panel');
    if (panel) {
      panel.classList.remove('panel-hidden');
    } else {
      const newPanel = createAnalysisPanel();
      // 发送消息到后台获取分析数据
      analyzeProduct();
    }
  });
  
  document.body.appendChild(button);
};

// ========== 主功能和消息处理 ==========

// 分析商品，发送数据到后台
const analyzeProduct = async () => {
  try {
    // 提取商品信息
    const productInfo = extractProductInfo();
    if (!productInfo) {
      console.error('无法提取商品信息');
      return;
    }
    
    // 提取评论数据
    const reviewData = await extractReviewData();
    
    // 提取卖家信息
    const sellerInfo = extractSellerInfo();
    
    // 组合数据
    productData = {
      product: productInfo,
      review: reviewData,
      seller: sellerInfo
    };
    
    // 发送数据到后台进行分析
    chrome.runtime.sendMessage({
      action: 'analyzeProduct',
      data: productData
    }, (response) => {
      console.log('分析结果:', response);
      
      // 更新面板内容
      const panel = document.querySelector('.jd-assistant-panel');
      if (panel) {
        updateAnalysisPanel(panel, response);
      }
    });
  } catch (error) {
    console.error('分析商品时出错:', error);
  }
};

// 监听来自背景脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getProductData') {
    sendResponse({ success: true, data: productData });
  }
});

// 当页面加载完成后初始化
window.addEventListener('load', () => {
  console.log('京东智能购物助手已加载');
  
  // 检查是否是商品页面
  if (window.location.href.includes('item.jd.com')) {
    console.log('检测到京东商品页面');
    
    // 添加悬浮按钮
    addFloatingButton();
    
    // 延迟一段时间后分析商品，确保页面元素加载完成
    setTimeout(() => {
      analyzeProduct();
    }, 1500);
  }
}); 