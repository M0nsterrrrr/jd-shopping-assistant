/**
 * API通信模块 - 与Dify导出的OpenAI格式API交互
 */

// 默认API配置
const DEFAULT_CONFIG = {
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions', // 替换为实际的API地址
  model: 'qwen/qwen3-4b:free',
  apiKey: '', // 初始为空，将从.env文件中加载
  timeout: 20000, // 20秒超时
  headers: {
    'Content-Type': 'application/json',
    'X-Title': 'JD-Shopping-Assistant'
  }
};

// 存储API配置
let apiConfig = { ...DEFAULT_CONFIG };

/**
 * 设置API配置
 * @param {Object} config - API配置对象
 */
export const setApiConfig = (config) => {
  apiConfig = { ...apiConfig, ...config };
};

/**
 * 分析商品数据
 * @param {Object} productData - 商品数据对象 
 * @returns {Promise} 返回分析结果
 */
export const analyzeProduct = async (productData) => {
  try {
    const { product, review, seller } = productData;
    
    // 发送请求到Dify Agent API
    const response = await fetchWithTimeout(
      apiConfig.apiUrl,
      {
        method: 'POST',
        body: JSON.stringify({
          model: apiConfig.model,
          messages: [
            {
              role: 'system',
              content: '您是一个专业的商品分析助手，请分析以下商品信息并以JSON格式返回分析结果。'
            },
            {
              role: 'user',
              content: `请分析商品ID:${product.id}的价格趋势、评论真实性和卖家信誉。所有分析结果必须使用JSON格式返回，包含price_trend、review_score、seller_score等字段。`
            }
          ],
          temperature: 0.7,
        })
      },
      apiConfig.timeout
    );

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }
    
    try {
      const data = await response.json();
      // 一些API可能有特定的错误格式
      if (data.error || data.err_msg) {
        throw new Error(data.error?.message || data.err_msg || '未知错误');
      }
      return processApiResponse(data, productData);
    } catch (error) {
      console.error('分析商品失败:', error);
      return {
        success: false,
        error: error.message || '请求失败',
      };
    }
  } catch (error) {
    console.error('分析商品失败:', error);
    return {
      success: false,
      error: error.message || '请求失败',
    };
  }
};

/**
 * 获取分析决策的溯源信息
 * @param {string} productId - 商品ID
 * @returns {Promise} 返回决策溯源信息
 */
export const getAnalysisSource = async (productId) => {
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
              content: '您是一个专业的商品分析助手，请分析以下商品信息并以JSON格式返回分析结果。'
            },
            {
              role: 'user',
              content: `请分析商品ID:${productId}的分析决策溯源`
            }
          ]
        })
      },
      apiConfig.timeout
    );

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      success: true,
      data: processSourceResponse(data)
    };
  } catch (error) {
    console.error('获取决策溯源失败:', error);
    return {
      success: false,
      error: error.message || '请求失败',
    };
  }
};

/**
 * 处理聊天消息的发送和接收
 * @param {string} userMessage - 用户发送的消息
 * @returns {Promise} 返回聊天回复
 */
export const sendChatMessage = async (userMessage) => {
  try {
    // 如果API密钥为空，报告错误
    if (!apiConfig.apiKey) {
      throw new Error('API密钥未配置。请确保已设置有效的API密钥');
    }
    
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
    
    // 处理API响应，提取聊天回复
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
      return { success: true, answer: data.choices[0].message.content };
    } else {
      // 兼容 parseApiResponse 的逻辑，如果API响应不直接是聊天内容
      const parsedData = parseApiResponse(data);
      if (parsedData.text || (parsedData.answer && typeof parsedData.answer === 'string')) {
         return { success: true, answer: parsedData.text || parsedData.answer };
      }
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

/**
 * 处理API响应数据
 * @param {Object} apiResponse - API响应数据
 * @param {Object} originalData - 原始商品数据
 * @returns {Object} 处理后的数据
 */
const processApiResponse = (apiResponse, originalData) => {
  // 兼容检查不同模型的响应结构
  if (!apiResponse.choices && apiResponse.candidates) {
    // 适配某些使用candidates而不是choices的API
    apiResponse.choices = apiResponse.candidates;
  }

  // 检查API返回的数据格式
  if (!apiResponse.choices || !apiResponse.choices[0] || !apiResponse.choices[0].message) {
    throw new Error('API响应格式不正确');
  }

  try {
    // 获取API返回的内容
    const responseContent = apiResponse.choices[0].message.content;
    
    // 如果内容是JSON字符串，解析它
    let analysisResult;
    if (typeof responseContent === 'string') {
      try {
        analysisResult = JSON.parse(responseContent);
      } catch (e) {
        // 如果不是JSON字符串，尝试从文本中提取信息
        analysisResult = extractDataFromText(responseContent);
      }
    } else {
      // 如果已经是对象，直接使用
      analysisResult = responseContent;
    }

    // 构建返回的分析结果
    return {
      success: true,
      timestamp: new Date().toISOString(),
      product: originalData.product,
      priceData: analysisResult.price_trend || {
        lowest: '暂无数据',
        highest: '暂无数据',
        current: originalData.product.price,
        recommendation: '暂无建议'
      },
      reviewData: analysisResult.review_score ? {
        score: analysisResult.review_score,
        authenticity: analysisResult.review_authenticity || 0,
        total: originalData.review?.totalReviews || 0,
        summary: analysisResult.review_summary || '暂无评论分析'
      } : null,
      sellerData: {
        score: analysisResult.seller_score || 0,
        shopScore: originalData.seller?.shopScore || 0,
        service: analysisResult.seller_service || '暂无数据',
        riskLevel: analysisResult.seller_risk || 'Medium'
      },
      alternatives: analysisResult.alternatives || []
    };
  } catch (error) {
    console.error('处理API响应失败:', error);
    return {
      success: false,
      error: '解析分析结果失败'
    };
  }
};

/**
 * 处理溯源响应数据
 * @param {Object} sourceResponse - 溯源API响应
 * @returns {Object} 处理后的溯源数据
 */
const processSourceResponse = (sourceResponse) => {
  // 检查API返回的数据格式
  if (!sourceResponse.choices || !sourceResponse.choices[0] || !sourceResponse.choices[0].message) {
    throw new Error('API响应格式不正确');
  }

  const responseContent = sourceResponse.choices[0].message.content;
  
  // 如果内容是JSON字符串，解析它
  if (typeof responseContent === 'string') {
    try {
      return JSON.parse(responseContent);
    } catch (e) {
      // 如果不是JSON字符串，返回原始文本
      return { 
        text: responseContent,
        rawSourceData: true
      };
    }
  }
  
  return responseContent;
};

/**
 * 从文本中提取结构化数据
 * @param {string} text - 文本内容
 * @returns {Object} 提取的结构化数据
 */
const extractDataFromText = (text) => {
  // 这是一个简单的实现，实际应用中可能需要更复杂的解析逻辑
  const result = {
    price_trend: {},
    review_score: 0,
    seller_score: 0,
    seller_risk: 'Medium',
    alternatives: []
  };

  // 尝试提取价格数据
  const lowestMatch = text.match(/最低[价格][：:]\s*￥?(\d+(\.\d+)?)/);
  const highestMatch = text.match(/最高[价格][：:]\s*￥?(\d+(\.\d+)?)/);
  const currentMatch = text.match(/当前[价格][：:]\s*￥?(\d+(\.\d+)?)/);
  
  if (lowestMatch) result.price_trend.lowest = parseFloat(lowestMatch[1]);
  if (highestMatch) result.price_trend.highest = parseFloat(highestMatch[1]);
  if (currentMatch) result.price_trend.current = parseFloat(currentMatch[1]);

  // 尝试提取评论得分
  const reviewMatch = text.match(/评论[可信度得分分数][：:]\s*(\d+(\.\d+)?)/);
  if (reviewMatch) result.review_score = parseFloat(reviewMatch[1]);

  // 尝试提取卖家信息
  const sellerMatch = text.match(/卖家[评分信用][：:]\s*(\d+(\.\d+)?)/);
  if (sellerMatch) result.seller_score = parseFloat(sellerMatch[1]);

  // 尝试提取风险等级
  const riskMatch = text.match(/风险[等级级别][：:]\s*(\w+)/);
  if (riskMatch) {
    const riskText = riskMatch[1].toLowerCase();
    if (riskText.includes('低') || riskText.includes('low')) {
      result.seller_risk = 'Low';
    } else if (riskText.includes('高') || riskText.includes('high')) {
      result.seller_risk = 'High';
    } else {
      result.seller_risk = 'Medium';
    }
  }

  return result;
};

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
    'Authorization': `Bearer ${apiConfig.apiKey}` // 正确地使用apiConfig.apiKey
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

export default {
  setApiConfig,
  analyzeProduct,
  getAnalysisSource,
  sendChatMessage
}; 
