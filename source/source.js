/**
 * 京东智能购物助手 - 决策溯源页面脚本
 */

document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const productTitle = document.getElementById('productTitle');
  const productMeta = document.getElementById('productMeta');
  const loadingContainer = document.getElementById('loadingContainer');
  const errorContainer = document.getElementById('errorContainer');
  const errorMessage = document.getElementById('errorMessage');
  const retryButton = document.getElementById('retryButton');
  const sourceContainer = document.getElementById('sourceContainer');
  const priceMethodology = document.getElementById('priceMethodology');
  const priceDataSource = document.getElementById('priceDataSource');
  const reviewMethodology = document.getElementById('reviewMethodology');
  const reviewKeywords = document.getElementById('reviewKeywords');
  const reviewExamples = document.getElementById('reviewExamples');
  const sellerMethodology = document.getElementById('sellerMethodology');
  const sellerHistory = document.getElementById('sellerHistory');
  const rawData = document.getElementById('rawData');
  const analysisTime = document.getElementById('analysisTime');
  const exportButton = document.getElementById('exportButton');
  const closeButton = document.getElementById('closeButton');

  // 存储商品和溯源数据
  let productData = null;
  let sourceData = null;

  // 初始化
  const initialize = async () => {
    // 获取当前窗口的URL中的查询参数
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('productId');
    const tabId = parseInt(urlParams.get('tabId') || '0');

    if (!productId && !tabId) {
      showError('无法获取商品信息，请重新打开溯源窗口');
      return;
    }

    try {
      // 获取商品数据
      if (tabId) {
        await loadProductData(tabId);
      }

      // 获取溯源数据
      if (productId || (productData && productData.id)) {
        await loadSourceData(productId || productData.id);
      } else {
        showError('无法识别商品ID');
      }
    } catch (error) {
      showError(error.message || '加载数据失败');
    }
  };

  // 加载商品数据
  const loadProductData = (tabId) => {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'getProductData', tabId },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!response || !response.success) {
              reject(new Error(response?.error || '获取商品数据失败'));
              return;
            }

            productData = response.data.product;
            updateProductInfo(productData);
            resolve(productData);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  };

  // 加载溯源数据
  const loadSourceData = (productId) => {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: 'getAnalysisSource', productId },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }

            if (!response || !response.success) {
              reject(new Error(response?.error || '获取溯源数据失败'));
              return;
            }

            sourceData = response.data;
            renderSourceData(sourceData);
            resolve(sourceData);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  };

  // 更新商品信息
  const updateProductInfo = (product) => {
    if (!product) return;

    productTitle.textContent = product.title || '未知商品';
    productMeta.textContent = `商品ID: ${product.id || '未知'} | 价格: ￥${product.price || '未知'}`;
  };

  // 渲染溯源数据
  const renderSourceData = (data) => {
    if (!data) {
      showError('溯源数据为空');
      return;
    }

    // 隐藏加载中状态
    loadingContainer.style.display = 'none';
    
    // 显示溯源容器
    sourceContainer.style.display = 'block';

    // 更新分析时间
    analysisTime.textContent = formatDateTime(data.timestamp || new Date());

    // 如果是原始文本格式
    if (data.rawSourceData) {
      renderRawTextSource(data.text);
      return;
    }

    // 渲染价格分析溯源
    if (data.price_source) {
      renderPriceSource(data.price_source);
    }

    // 渲染评论分析溯源
    if (data.review_source) {
      renderReviewSource(data.review_source);
    }

    // 渲染卖家分析溯源
    if (data.seller_source) {
      renderSellerSource(data.seller_source);
    }

    // 渲染原始数据
    renderRawData(data);
  };

  // 渲染原始文本内容
  const renderRawTextSource = (text) => {
    rawData.textContent = text;
    
    // 隐藏其他部分
    document.querySelectorAll('.source-section').forEach(section => {
      if (!section.querySelector('.raw-data')) {
        section.style.display = 'none';
      }
    });
  };

  // 渲染价格分析溯源
  const renderPriceSource = (priceSource) => {
    if (!priceSource) return;

    // 渲染分析方法
    priceMethodology.innerHTML = priceSource.methodology || '未提供分析方法';

    // 渲染数据来源
    priceDataSource.innerHTML = priceSource.data_source 
      ? `<p>${priceSource.data_source}</p>`
      : '<p>未提供数据来源信息</p>';

    // TODO: 如果有图表数据，可以使用图表库渲染价格趋势图
    // 如果需要图表，可以使用Chart.js等库实现
  };

  // 渲染评论分析溯源
  const renderReviewSource = (reviewSource) => {
    if (!reviewSource) return;

    // 渲染分析方法
    reviewMethodology.innerHTML = reviewSource.methodology || '未提供分析方法';

    // 渲染关键词
    if (reviewSource.keywords && reviewSource.keywords.length > 0) {
      const keywordsHtml = reviewSource.keywords.map(keyword => {
        const type = keyword.sentiment || 'neutral';
        return `<span class="keyword-tag ${type}">${keyword.word} (${keyword.weight || '0'})</span>`;
      }).join('');
      reviewKeywords.innerHTML = keywordsHtml;
    } else {
      reviewKeywords.innerHTML = '<p>未提供关键词信息</p>';
    }

    // 渲染评论示例
    if (reviewSource.examples && reviewSource.examples.length > 0) {
      const examplesHtml = reviewSource.examples.map(example => {
        const className = example.is_suspicious ? 'suspicious' : 'genuine';
        return `
          <div class="review-example ${className}">
            <div class="review-text">${example.content}</div>
            <div class="review-meta">
              用户: ${example.user_id || '匿名'} | 时间: ${example.date || '未知'}
            </div>
            ${example.reason ? `<div class="review-reason">原因: ${example.reason}</div>` : ''}
          </div>
        `;
      }).join('');
      reviewExamples.innerHTML = examplesHtml;
    } else {
      reviewExamples.innerHTML = '<p>未提供评论示例</p>';
    }
  };

  // 渲染卖家分析溯源
  const renderSellerSource = (sellerSource) => {
    if (!sellerSource) return;

    // 渲染分析方法
    sellerMethodology.innerHTML = sellerSource.methodology || '未提供分析方法';

    // 渲染历史数据
    if (sellerSource.history) {
      const historyHtml = `
        <div class="seller-history">
          <p>店铺评分: ${sellerSource.history.shop_score || '未知'}</p>
          <p>30天投诉率: ${sellerSource.history.complaint_rate || '未知'}</p>
          <p>售后纠纷: ${sellerSource.history.dispute_rate || '未知'}</p>
          ${sellerSource.history.notes ? `<p class="seller-notes">${sellerSource.history.notes}</p>` : ''}
        </div>
      `;
      sellerHistory.innerHTML = historyHtml;
    } else {
      sellerHistory.innerHTML = '<p>未提供历史数据</p>';
    }
  };

  // 渲染原始数据
  const renderRawData = (data) => {
    try {
      rawData.textContent = JSON.stringify(data, null, 2);
    } catch (error) {
      rawData.textContent = '无法显示原始数据';
    }
  };

  // 显示错误信息
  const showError = (message) => {
    loadingContainer.style.display = 'none';
    errorContainer.style.display = 'block';
    errorMessage.textContent = message || '加载数据失败';
  };

  // 格式化日期时间
  const formatDateTime = (date) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      return '未知时间';
    }
  };

  // 导出报告
  const exportReportAsPDF = () => {
    // 在实际实现中，可以使用html2pdf或jsPDF等库将内容导出为PDF
    alert('此功能正在开发中');
  };

  // 绑定事件
  retryButton.addEventListener('click', initialize);
  exportButton.addEventListener('click', exportReportAsPDF);
  closeButton.addEventListener('click', () => window.close());

  // 初始化页面
  initialize();
}); 