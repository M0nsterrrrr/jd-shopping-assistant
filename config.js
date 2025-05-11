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

// 导出配置
const getConfig = async () => {
  const env = await loadEnvironmentVariables();
  
  return {
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'qwen/qwen3-30b-a3b:free',
    apiKey: env.OPENROUTER_API_KEY || '',
    timeout: 20000,
    headers: {
      'Content-Type': 'application/json',
      'X-Title': 'JD-Shopping-Assistant'
    }
  };
};

export { getConfig }; 