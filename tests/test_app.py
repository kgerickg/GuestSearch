import unittest
from playwright.sync_api import sync_playwright, expect
import os
import re

class TestGuestSearch(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)
        cls.base_url = "http://localhost:8000/index.html"

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.page = self.browser.new_page()
        # Mock Google Sheets fetch to fail so it uses local CSV
        self.page.route("https://docs.google.com/spreadsheets/**/*", lambda route: route.abort())

    def tearDown(self):
        self.page.close()

    def test_highlight_function(self):
        self.page.goto(self.base_url)
        # Test the highlight function directly in the browser context
        result = self.page.evaluate('highlight("Hello world", "world")')
        self.assertEqual(result, "Hello <mark>world</mark>")

        result = self.page.evaluate('highlight("Hello world", "o")')
        self.assertEqual(result, "Hell<mark>o</mark> w<mark>o</mark>rld")

        result = self.page.evaluate('highlight("Hello world", "")')
        self.assertEqual(result, "Hello world")

    def test_page_title(self):
        self.page.goto(self.base_url)
        expect(self.page).to_have_title("賓客座位查詢")

    def test_name_search(self):
        self.page.goto(self.base_url)
        # Wait for the data to load by checking summary text
        expect(self.page.locator("#summary")).to_contain_text("共")

        search_input = self.page.get_by_placeholder("輸入姓名任一字")
        search_input.fill("黃姿瑜")

        # Wait for results
        expect(self.page.get_by_text("查詢到 1 筆")).to_be_visible()
        expect(self.page.locator("#results .result")).to_have_count(1)
        expect(self.page.locator("#results .result")).to_contain_text("黃姿瑜")
        expect(self.page.locator("#results .table-number")).to_have_text("1")

    def test_special_characters_search(self):
        self.page.goto(self.base_url)
        expect(self.page.locator("#summary")).to_contain_text("共")

        search_input = self.page.get_by_placeholder("輸入姓名任一字")
        # Try a character that is special in Regex
        search_input.fill("(")

        # This shouldn't crash the app
        expect(self.page.get_by_text("查詢到 2 筆")).to_be_visible()
        # Results should be visible
        expect(self.page.locator("#results .result")).to_have_count(2)

    def test_table_search(self):
        self.page.goto(self.base_url)
        expect(self.page.locator("#summary")).to_contain_text("共")

        # Click on Table Search tab
        self.page.get_by_role("button", name="桌次查詢").click()

        table_search_input = self.page.get_by_placeholder("請輸入桌次號碼")
        table_search_input.fill("2")

        # Should show guests in table 2
        expect(self.page.get_by_text("第 2 桌（共 5 位賓客）")).to_be_visible()
        # 1 for table image/name + 5 guests
        expect(self.page.locator("#tableResults .result")).to_have_count(6)

    def test_theme_toggle(self):
        self.page.goto(self.base_url)
        body = self.page.locator("body")

        # Default should not have dark-mode class
        expect(body).not_to_have_class(re.compile(r"dark-mode"))

        # Click toggle
        self.page.locator("#theme-toggle-codepen").click()
        expect(body).to_have_class(re.compile(r"dark-mode"))

        # Click again
        self.page.locator("#theme-toggle-codepen").click()
        expect(body).not_to_have_class(re.compile(r"dark-mode"))

if __name__ == "__main__":
    unittest.main()
