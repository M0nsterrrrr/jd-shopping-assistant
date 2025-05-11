/**
 * 数据解析工具模块 - 用于处理和转换数据格式
 */

/**
 * 解析价格字符串为数字
 * @param {string} priceStr - 价格字符串
 * @returns {number} 价格数字
 */
export const parsePrice = (priceStr) => {
  if (!priceStr) return 0;
  
  // 移除非数字字符（保留小数点）
  const cleanPrice = priceStr.replace(/[^\d.]/g, '');
  return parseFloat(cleanPrice) || 0;
};

/**
 * 格式化价格为人民币格式
 * @param {number|string} price - 价格数字或字符串
 * @returns {string} 格式化后的价格
 */
export const formatPrice = (price) => {
  const priceNum = parsePrice(price);
  return `￥${priceNum.toFixed(2)}`;
};

/**
 * 解析日期字符串为Date对象
 * @param {string} dateStr - 日期字符串
 * @returns {Date} 日期对象
 */
export const parseDate = (dateStr) => {
  if (!dateStr) return new Date();
  
  try {
    return new Date(dateStr);
  } catch (e) {
    console.error('解析日期失败:', e);
    return new Date();
  }
};

/**
 * 格式化日期为中文格式
 * @param {Date|string} date - 日期对象或字符串
 * @returns {string} 格式化后的日期
 */
export const formatDate = (date) => {
  const dateObj = date instanceof Date ? date : parseDate(date);
  
  return dateObj.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * 截断文本并添加省略号
 * @param {string} text - 原始文本
 * @param {number} length - 最大长度
 * @returns {string} 截断后的文本
 */
export const truncateText = (text, length = 30) => {
  if (!text) return '';
  
  return text.length > length 
    ? text.substring(0, length) + '...'
    : text;
};

/**
 * 解析评论可信度为颜色代码
 * @param {number} score - 评论可信度得分
 * @returns {string} 颜色代码
 */
export const getScoreColor = (score) => {
  if (score >= 7) {
    return '#52c41a'; // 绿色 - 高可信度
  } else if (score >= 5) {
    return '#faad14'; // 黄色 - 中等可信度
  } else {
    return '#ff4d4f'; // 红色 - 低可信度
  }
};

/**
 * 解析风险等级为颜色和文本
 * @param {string} riskLevel - 风险等级
 * @returns {Object} 包含颜色和文本的对象
 */
export const parseRiskLevel = (riskLevel) => {
  const level = (riskLevel || '').toLowerCase();
  
  if (level.includes('low') || level.includes('低')) {
    return { 
      color: '#52c41a', 
      text: '低风险',
      className: 'risk-low'
    };
  } else if (level.includes('high') || level.includes('高')) {
    return { 
      color: '#ff4d4f', 
      text: '高风险',
      className: 'risk-high'
    };
  } else {
    return { 
      color: '#faad14', 
      text: '中等风险',
      className: 'risk-medium'
    };
  }
};

/**
 * 解析API响应为标准格式
 * @param {Object} response - API响应对象
 * @returns {Object} 标准格式的数据
 */
export const parseApiResponse = (response) => {
  // 防御性编程，确保有有效响应
  if (!response || !response.choices || !response.choices[0]) {
    return { error: '无效的API响应' };
  }
  
  try {
    const content = response.choices[0].message.content;
    
    // 如果内容是字符串，尝试解析为JSON
    if (typeof content === 'string') {
      try {
        return JSON.parse(content);
      } catch (e) {
        // 不是有效的JSON，返回原始内容
        return { text: content };
      }
    }
    
    // 如果内容已经是对象，直接返回
    return content;
  } catch (error) {
    console.error('解析API响应失败:', error);
    return { error: '解析响应失败' };
  }
};

export default {
  parsePrice,
  formatPrice,
  parseDate,
  formatDate,
  truncateText,
  getScoreColor,
  parseRiskLevel,
  parseApiResponse
}; 