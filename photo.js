
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// =====================================================
// НАСТРОЙКИ
// =====================================================

const TOKEN = 'vk1.a.4zvWPEHlpndvzclVw7MWQp1JSODJNSajEcOtw-C9akCTX37NEyCcY1cBoRr509HYbONIpXCoumJR8JjGaodK48P-rh-LC0C-kwMpu5v0E63ujqSPrSuyv6cxfKCvZWghUVy5n7ib0zVtCemcypr6ya30JKnUBmRAmyObdEqMeknznkHiVvyRfMW4zutjSymK_Q1SZ1XUVECM_nXlJddT5g'; // Вставьте сюда ваш токен
const OWNER_ID = 31146066;
const API_VERSION = '5.199';

const DOWNLOAD_DIR = path.join(process.cwd(), 'photos');

// =====================================================
// ПРОВЕРКИ
// =====================================================

if (!TOKEN) {
  console.error('Ошибка: не задан VK_TOKEN');
  console.error('');
  console.error('Перед запуском выполни:');
  console.error("export VK_TOKEN='ТВОЙ_ТОКЕН'");
  process.exit(1);
}

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// =====================================================
// VK API
// =====================================================

async function vk(method, params = {}) {
  try {
    const response = await axios.get(
      `https://api.vk.com/method/${method}`,
      {
        params: {
          ...params,
          access_token: TOKEN,
          v: API_VERSION
        }
      }
    );

    if (response.data.error) {
      const error = response.data.error;

      throw new Error(
        `${error.error_code}: ${error.error_msg}`
      );
    }

    return response.data.response;

  } catch (error) {
    if (error.response?.data?.error) {
      const vkError = error.response.data.error;

      throw new Error(
        `${vkError.error_code}: ${vkError.error_msg}`
      );
    }

    throw error;
  }
}

// =====================================================
// ВЫБОР САМОЙ БОЛЬШОЙ ФОТОГРАФИИ
// =====================================================

function getBestPhotoSize(photo) {
  if (!photo.sizes || photo.sizes.length === 0) {
    return null;
  }

  return photo.sizes.reduce((best, current) => {
    const bestArea = best.width * best.height;
    const currentArea = current.width * current.height;

    return currentArea > bestArea ? current : best;
  });
}

// =====================================================
// СКАЧИВАНИЕ ФОТО
// =====================================================

async function downloadPhoto(photo, folder, index) {
  const size = getBestPhotoSize(photo);

  if (!size || !size.url) {
    console.log(`  Пропуск фото ${photo.id}: URL отсутствует`);
    return;
  }

  const dir = path.join(DOWNLOAD_DIR, folder);

  fs.mkdirSync(dir, { recursive: true });

  const filename = `${index}_${photo.id}.jpg`;
  const filePath = path.join(dir, filename);

  try {
    const response = await axios.get(size.url, {
      responseType: 'arraybuffer'
    });

    fs.writeFileSync(filePath, response.data);

    console.log(
      `  ✓ ${filename} (${size.width}x${size.height})`
    );

  } catch (error) {
    console.log(
      `  ✗ Ошибка скачивания ${photo.id}: ${error.message}`
    );
  }
}

// =====================================================
// АВАТАР ПРОФИЛЯ
// =====================================================

async function downloadProfilePhoto() {
  console.log('\n=== АВАТАР ПРОФИЛЯ ===');

  const response = await vk('users.get', {
    user_ids: OWNER_ID,
    fields: 'photo_200,photo_max_orig'
  });

  const user = response[0];

  if (!user) {
    console.log('Пользователь не найден');
    return;
  }

  const url = user.photo_max_orig || user.photo_200;

  if (!url) {
    console.log('Аватар не найден');
    return;
  }

  const dir = path.join(DOWNLOAD_DIR, 'profile');
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, 'avatar.jpg');

  try {
    const image = await axios.get(url, {
      responseType: 'arraybuffer'
    });

    fs.writeFileSync(filePath, image.data);

    console.log(`✓ Аватар сохранён: ${filePath}`);

  } catch (error) {
    console.log(`✗ Ошибка скачивания аватара: ${error.message}`);
  }
}

// =====================================================
// ФОТОГРАФИИ ПРОФИЛЯ
// =====================================================

async function downloadProfilePhotos() {
  console.log('\n=== ФОТОГРАФИИ ПРОФИЛЯ ===');

  try {
    const response = await vk('photos.getAll', {
      owner_id: OWNER_ID,
      extended: 1,
      count: 200
    });

    const photos = response.items || [];

    console.log(`Найдено фотографий: ${photos.length}`);

    for (let i = 0; i < photos.length; i++) {
      await downloadPhoto(
        photos[i],
        'profile',
        i + 1
      );
    }

  } catch (error) {
    console.log(`Ошибка photos.getAll: ${error.message}`);
  }
}

// =====================================================
// ФОТОГРАФИИ СО СТЕНЫ
// =====================================================

async function downloadWallPhotos() {
  console.log('\n=== ФОТОГРАФИИ СО СТЕНЫ ===');

  try {
    const response = await vk('wall.get', {
      owner_id: OWNER_ID,
      count: 100,
      filter: 'all'
    });

    const posts = response.items || [];

    console.log(`Найдено записей на стене: ${posts.length}`);

    let photoNumber = 0;

    for (const post of posts) {

      if (!post.attachments) {
        continue;
      }

      for (const attachment of post.attachments) {

        if (attachment.type !== 'photo') {
          continue;
        }

        photoNumber++;

        console.log(
          `\nЗапись ${post.id}: фотография ${photoNumber}`
        );

        await downloadPhoto(
          attachment.photo,
          'wall',
          photoNumber
        );
      }
    }

    console.log(
      `\nФотографий со стены скачано/обработано: ${photoNumber}`
    );

  } catch (error) {
    console.log(`Ошибка wall.get: ${error.message}`);
  }
}

// =====================================================
// АЛЬБОМЫ
// =====================================================

async function downloadAlbums() {
  console.log('\n=== АЛЬБОМЫ ===');

  try {
    const response = await vk('photos.getAlbums', {
      owner_id: OWNER_ID,
      need_system: 1
    });

    const albums = response.items || [];

    console.log(`Найдено альбомов: ${albums.length}`);

    for (const album of albums) {

      console.log(
        `\nАльбом: ${album.title} (ID ${album.id})`
      );

      try {
        const photosResponse = await vk('photos.get', {
          owner_id: OWNER_ID,
          album_id: album.id,
          extended: 1,
          count: 1000
        });

        const photos = photosResponse.items || [];

        console.log(
          `Фотографий в альбоме: ${photos.length}`
        );

        const safeName = album.title
          .replace(/[<>:"/\\|?*]/g, '_')
          .trim();

        for (let i = 0; i < photos.length; i++) {

          await downloadPhoto(
            photos[i],
            `albums/${safeName}`,
            i + 1
          );
        }

      } catch (error) {
        console.log(
          `Ошибка альбома ${album.id}: ${error.message}`
        );
      }
    }

  } catch (error) {
    console.log(
      `Ошибка photos.getAlbums: ${error.message}`
    );
  }
}

// =====================================================
// MAIN
// =====================================================

async function main() {

  console.log('======================================');
  console.log(' VK PHOTO BACKUP');
  console.log('======================================');
  console.log(`VK ID: ${OWNER_ID}`);
  console.log(`Папка: ${DOWNLOAD_DIR}`);

  await downloadProfilePhoto();

  await downloadProfilePhotos();

  await downloadAlbums();

  await downloadWallPhotos();

  console.log('\n======================================');
  console.log('Готово!');
  console.log(`Фотографии находятся здесь:`);
  console.log(DOWNLOAD_DIR);
  console.log('======================================');
}

main().catch(error => {
  console.error('\nКритическая ошибка:', error.message);
});

