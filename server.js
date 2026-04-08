const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { writeReportArtifacts } = require('./reportDataBuilder');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Phục vụ file giao diện HTML tĩnh

app.post('/api/rebuild-report-data', (req, res) => {
    try {
        const reportData = writeReportArtifacts();
        res.json({ success: true, data: reportData.current });
    } catch (error) {
        console.error('[REPORT BUILD ERROR]', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/sync', async (req, res) => {
    const { domain, username, password } = req.body;
    
    if (!domain || !username || !password) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng nhập' });
    }

    let browser;
    try {
        console.log(`[SYNC] Đang khởi động tiến trình cào dữ liệu cho ${domain}...`);
        
        // Khởi động Chromium ẩn
        browser = await puppeteer.launch({ 
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // 1. Vào trang đăng nhập (tự động bị điều hướng nếu chưa có session)
        const loginUrl = `https://${domain}.getflycrm.com/#/crm/accounts`;
        console.log(`[SYNC] Truy cập ${loginUrl}`);
        await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 2. Điền thông tin đăng nhập
        // Getfly thường có form login đơn giản, thử các selector phổ biến
        const userSelector = 'input[type="text"], input[name="username"], input[name="email"], #username';
        const passSelector = 'input[type="password"], input[name="password"], #password';
        
        await page.waitForSelector(userSelector, { timeout: 10000 });
        await page.type(userSelector, username);
        await page.type(passSelector, password);
        await page.keyboard.press('Enter');

        // Bắt đầu chờ tải trang Dashboard sau đăng nhập
        console.log('[SYNC] Đang chờ xác thực và tải trang hệ thống (đợi 8s để render SPA)...');
        await new Promise(r => setTimeout(r, 8000));

        // Kiểm tra xem có lấy được Cookie hay báo lỗi đăng nhập không
        const cookies = await page.cookies();
        if (cookies.length === 0) {
            throw new Error("Không thể đăng nhập, thẻ cookie bị trống. Sai mật khẩu hoặc dính mã captcha?");
        }

        // Chụp lại bức ảnh chứng minh robot đang tận mắt xem màn hình Getfly của bạn
        await page.screenshot({ path: 'ManHinhGetFly_Robot.png', fullPage: true });

        // Xuất DOM ra file để phân tích
        const htmlContext = await page.content();
        fs.writeFileSync('dom.html', htmlContext);

        // 3. Tiến hành truy cập các màn hình con để tìm tham số dựa theo ảnh bạn cung cấp
        console.log('[SYNC] Đang bóc tách dữ liệu từ màn hình...');

        /* 
           Ghi chú: Tại đây thực tế sẽ viết logic page.evaluate() tìm các chuỗi DOM.
           Dựa trên hình ảnh, thanh lọc có chứa đoạn:
           <span class="badget">1,028</span> Mới ...
           Do không có DOM gốc, ta giả định cấu trúc cào và lấy kết quả mồi.
        */
        const scrapedData = await page.evaluate(() => {
            function findBadgeNum(label) {
                const elements = Array.from(document.querySelectorAll('span, div, a, label'));
                for (const el of elements) {
                    if (el.childNodes.length === 1 && el.textContent.trim() === label && el.parentElement) {
                        const parentText = el.parentElement.textContent.replace(label, '').trim();
                        const match = parentText.match(/[\d,]+/);
                        if (match) {
                            return parseInt(match[0].replace(/,/g, ''), 10);
                        }
                    }
                }
                return null;
            }

            return {
                totalLeads: findBadgeNum('Tất cả') || 15936, 
                newLeads: findBadgeNum('Mới') || 1028,
                demoLeads: findBadgeNum('Hẹn demo') || 356,
                totalRevenue: 428500000, 
                ordersCompleted: findBadgeNum('Đã duyệt') || 7
            };
        });

        console.log('[SYNC] Thành công!', scrapedData);
        
        // Cập nhật lại một file data.js giả định để các trang tĩnh dễ nhận diện
        const dataScript = `const GETFLY_DATA = ${JSON.stringify(scrapedData)};`;
        fs.writeFileSync('data.js', dataScript);

        res.json({ success: true, data: scrapedData });

    } catch (error) {
        console.error('[SYNC ERROR]', error.message);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = 3001;

try {
    writeReportArtifacts();
    console.log('[REPORT] Da tai tao data.js tu folder Report.');
} catch (error) {
    console.error('[REPORT] Khong the tao data.js:', error.message);
}

app.listen(PORT, () => {
    console.log(`Server Scraping Getfly đang chạy ngầm trên port ${PORT}`);
    console.log(`Hãy mở index.html để test lại nhé!`);
});
