
const axios = require('axios');

// === НАСТРОЙКИ ===
const TOKEN = 'vk1.a.4zvWPEHlpndvzclVw7MWQp1JSODJNSajEcOtw-C9akCTX37NEyCcY1cBoRr509HYbONIpXCoumJR8JjGaodK48P-rh-LC0C-kwMpu5v0E63ujqSPrSuyv6cxfKCvZWghUVy5n7ib0zVtCemcypr6ya30JKnUBmRAmyObdEqMeknznkHiVvyRfMW4zutjSymK_Q1SZ1XUVECM_nXlJddT5g'; // Вставьте сюда ваш токен
const OWNER_ID = 1118160545;        // Ваш ID ВКонтакте (только цифры)
// =================

const API = 'https://api.vk.com/method';
const VERSION = '5.199';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function vk(method, params = {}) {
  const response = await axios.get(`${API}/${method}`, {
    params: {
      ...params,
      access_token: TOKEN,
      v: VERSION
    }
  });

  if (response.data.error) {
    throw new Error(
      `${response.data.error.error_code}: ${response.data.error.error_msg}`
    );
  }

  return response.data.response;
}

async function clearAllWall() {
  try {
    console.log('Получаю записи со стены...');

    const response = await vk('wall.get', {
      owner_id: OWNER_ID,
      count: 100,
      filter: 'all'
    });

    const posts = response.items || [];

    console.log(`Найдено записей: ${posts.length}`);

    if (posts.length === 0) {
      console.log('Стена уже пуста.');
      return;
    }

    for (const post of posts) {
      // wall.delete может удалить только записи,
      // которые разрешено удалять этому токену.
      await vk('wall.delete', {
        owner_id: OWNER_ID,
        post_id: post.id
      });

      console.log(`Удалена запись ID: ${post.id}`);
      await delay(350);
    }

    console.log('Проверяю стену снова...');
    await clearAllWall();

  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

if (!TOKEN) {
  console.error('Не задан VK_TOKEN');
  process.exit(1);
}

clearAllWall();