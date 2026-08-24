require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const TOKEN = process.env.VK_TOKEN;
const VERSION = '5.199';

const USERS = [
    { id: 855126583, label: 'Оксана Калинина' }, // Пимашина?? ярославская жируха??
    { id: 220500260, label: 'Алекса Райнер' }
];

const CHECK_INTERVAL = 60 * 1000; // проверка каждую минуту
const CLOSE_MINUTES = 15;

const API = 'https://api.vk.com/method';

function formatTime(unix) {
    if (!unix) return 'неизвестно';

    return new Date(unix * 1000).toLocaleString('ru-RU', {
        timeZone: 'Asia/Tashkent',
        hour12: false
    });
}

function formatDifference(minutes) {
    if (minutes < 1) return `${Math.round(minutes * 60)} сек.`;
    return `${minutes.toFixed(1)} мин.`;
}

async function getUsers() {
    const ids = USERS.map(user => user.id).join(',');

    try {
        const response = await axios.get(`${API}/users.get`, {
            params: {
                access_token: TOKEN,
                v: VERSION,
                user_ids: ids,
                fields: 'last_seen'
            }
        });

        if (response.data.error) {
            throw new Error(
                `${response.data.error.error_code}: ${response.data.error.error_msg}`
            );
        }

        return response.data.response;
    } catch (error) {
        console.error(
            `[ERROR] ${new Date().toLocaleTimeString('ru-RU')} — ${error.message}`
        );

        return [];
    }
}

async function check() {
    const users = await getUsers();

    if (users.length === 0) {
        return;
    }

    const activity = [];

    for (const user of users) {
        const name = `${user.first_name} ${user.last_name}`;

        if (!user.last_seen) {
            console.log(
                `${name} (${user.id}) — last_seen недоступен`
            );
            continue;
        }

        const timestamp = user.last_seen.time;

        activity.push({
            id: user.id,
            name,
            timestamp
        });

        console.log(
            `${name} (${user.id}) — последняя активность: ${formatTime(timestamp)}`
        );
    }

    // Нужно минимум два аккаунта
    if (activity.length < 2) {
        return;
    }

    const a = activity[0];
    const b = activity[1];

    // Разница между временем активности
    const differenceSeconds = Math.abs(
        a.timestamp - b.timestamp
    );

    const differenceMinutes = differenceSeconds / 60;

    console.log(
        `Разница: ${formatDifference(differenceMinutes)}`
    );

    // ==========================================
    // ОПРЕДЕЛЯЕМ УРОВЕНЬ ВРЕМЕННОГО СОВПАДЕНИЯ
    // ==========================================

    let score = null;

    if (differenceMinutes <= 5) {
        score = 95;
    } else if (differenceMinutes <= 10) {
        score = 93;
    } else if (differenceMinutes <= 15) {
        score = 90;
    }

    // Более 15 минут — ничего не записываем
    if (score === null) {
        return;
    }

    const now = new Date().toLocaleString('ru-RU', {
        timeZone: 'Asia/Tashkent',
        hour12: false
    });

    // ==========================================
    // ЗАПИСЬ В LOGS.TXT
    // ==========================================

    const logText = `
[${now}] СОВПАДЕНИЕ
----------------------------------------
${a.name} (${a.id})
Последняя активность: ${formatTime(a.timestamp)}

${b.name} (${b.id})
Последняя активность: ${formatTime(b.timestamp)}

Разница между активностями: ${formatDifference(differenceMinutes)}
Временной интервал: <= 15 минут
Оценка временной близости: ${score}%
----------------------------------------

`;

    fs.appendFileSync(
        'logs.txt',
        logText,
        'utf8'
    );

    // ==========================================
    // ВЫВОД В КОНСОЛЬ
    // ==========================================

    console.log('\n🔥 СОВПАДЕНИЕ');

    console.log(
        `${a.name} — ${formatTime(a.timestamp)}`
    );

    console.log(
        `${b.name} — ${formatTime(b.timestamp)}`
    );

    console.log(
        `Разница: ${formatDifference(differenceMinutes)}`
    );

    console.log(
        `Оценка временной близости: ${score}%`
    );

    console.log(
        'Записано в logs.txt'
    );
}

async function main() {
    if (!TOKEN) {
        console.error(
            'Ошибка: VK_TOKEN не найден в .env'
        );
        process.exit(1);
    }

    console.log('VK Activity Monitor запущен');
    console.log(`Интервал проверки: ${CHECK_INTERVAL / 1000} сек.`);
    console.log(`Отслеживаем аккаунтов: ${USERS.length}`);

    await check();

    setInterval(check, CHECK_INTERVAL);
}

main();
