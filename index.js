const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// List of security headers to check
const SECURITY_HEADERS = [
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'X-Frame-Options',
  'Content-Security-Policy',
  'Referrer-Policy',
  'Permissions-Policy'
];

class SecurityHeaderCrawler {
  constructor(baseUrl, maxPages = 5) {
    this.baseUrl = baseUrl;
    this.visitedUrls = new Set();
    this.maxPages = maxPages;
  }

  async crawl() {
    const pagesToVisit = [this.baseUrl];

    while (pagesToVisit.length > 0 && this.visitedUrls.size < this.maxPages) {
      const currentUrl = pagesToVisit.shift();

      if (this.visitedUrls.has(currentUrl)) {
        continue;
      }

      console.log(`\n🔎 Scanning: ${currentUrl}`);
      this.visitedUrls.add(currentUrl);

      try {
        const response = await axios.get(currentUrl, { timeout: 5000 });
        
        this.checkSecurityHeaders(currentUrl, response.headers);

        const links = this.extractInternalLinks(response.data, currentUrl);
        
        for (const link of links) {
          if (!this.visitedUrls.has(link)) {
            pagesToVisit.push(link);
          }
        }

      } catch (error) {
        console.error(`❌ Failed to fetch ${currentUrl}: ${error.message}`);
      }
    }
  }

  checkSecurityHeaders(url, headers) {
    console.log(`🛡️ Security Headers on ${url}`);
    SECURITY_HEADERS.forEach(header => {
      if (headers[header.toLowerCase()]) {
        console.log(`✅ ${header}: ${headers[header.toLowerCase()]}`);
      } else {
        console.log(`❌ ${header} is MISSING!`);
      }
    });
  }

  extractInternalLinks(html, currentUrl) {
    const $ = cheerio.load(html);
    const links = new Set();

    const baseDomain = new URL(this.baseUrl).hostname;

    $('a[href]').each((_, element) => {
      let href = $(element).attr('href');
      if (!href) return;

      try {
        const absoluteUrl = new URL(href, currentUrl).href;
        const linkDomain = new URL(absoluteUrl).hostname;

        if (linkDomain === baseDomain) {
          links.add(absoluteUrl);
        }
      } catch (e) {
        // Ignore invalid URLs
      }
    });

    return Array.from(links);
  }
}

(async () => {
  const targetUrl = process.argv[2];

  if (!targetUrl || !targetUrl.startsWith('http')) {
    console.error('⚠️  Please provide a valid URL (include http:// or https://)');
    process.exit(1);
  }

  const crawler = new SecurityHeaderCrawler(targetUrl, 5);
  await crawler.crawl();
})();
