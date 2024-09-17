import { Router } from "express";
import asyncHandler from "express-async-handler";
import puppeteer from "puppeteer";

export default (router: Router) => {
    router.get(
        "/tvs",
        asyncHandler(async (req, res) => {
            try {
                const browser = await puppeteer.launch();
                const page = await browser.newPage();

                await page.goto('https://defillama.com/oracles/RedStone?doublecounted=true&borrowed=true', {
                    waitUntil: 'networkidle0',
                });
                await page.waitForSelector('h1', { timeout: 10000 });
                const tvsValue = await page.evaluate(() => {
                    const h1 = document.querySelector('h1');
                    if (h1) {
                        const p = h1.nextElementSibling as HTMLParagraphElement;
                        return p ? p.textContent : null;
                    }
                    return null;
                });

                await browser.close();

                res.json({ tvsValue });
            } catch (error) {
                console.error('Error scraping data:', error);
                res.status(500).json({ error: 'Failed to fetch data' });
            }
        })
    );
}