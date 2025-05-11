// 从.env文件读取配置
async function loadEnvironmentVariables() {
  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    const text = await response.text();
    
    // 解析.env文件
    const env = {};
    text.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const value = parts[1].trim();
        env[key] = value;
      }
    });
    
    return env;
  } catch (error) {
    console.error('无法加载.env文件:', error);
    return {};
  }
}

// API配置
const API_CONFIG = {
  // 基础配置
  BASE: {
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      'X-Title': 'JD-Shopping-Assistant'
    }
  },
  
  // 模型配置
  MODELS: {
    DEFAULT: 'qwen/qwen3-30b-a3b:free',
    ALTERNATIVES: {
      QWEN_TURBO: 'qwen/qwen3-4b:free',
      GPT35: 'openai/gpt-3.5-turbo',
      GPT4: 'openai/gpt-4'
    }
  },
  
  // API端点配置
  ENDPOINTS: {
    CHAT: 'https://openrouter.ai/api/v1/chat/completions',
    ANALYSIS: 'https://openrouter.ai/api/v1/analysis',  // 如果有专门的分析接口
  },
  
  // 请求配置
  REQUEST: {
    retries: 3,
    retryDelay: 1000,
    timeout: 20000
  }
};

// 导出配置
const getConfig = async () => {
  const env = await loadEnvironmentVariables();
  
  return {
    // API基础配置
    apiUrl: API_CONFIG.ENDPOINTS.CHAT,
    model: API_CONFIG.MODELS.DEFAULT,
    apiKey: env.OPENROUTER_API_KEY || '',
    
    // 请求配置
    timeout: API_CONFIG.REQUEST.timeout,
    retries: API_CONFIG.REQUEST.retries,
    retryDelay: API_CONFIG.REQUEST.retryDelay,
    
    // 请求头
    headers: {
      ...API_CONFIG.BASE.headers,
      'Authorization': `Bearer ${env.OPENROUTER_API_KEY || ''}`
    },
    
    // 所有可用模型
    availableModels: API_CONFIG.MODELS
  };
};

export { getConfig, API_CONFIG }; 