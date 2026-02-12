let guests = []
let total = 0
let currentlyFocusedResult = null; // 新增：用於追蹤當前焦點的結果項目
const searchInput = document.getElementById('search')
const resultsDiv = document.getElementById('results')
const summaryDiv = document.getElementById('summary')

function highlight(text, keyword) {
  if (!keyword) return text
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escapedKeyword, 'gi'), m => `<mark>${m}</mark>`)
}

function updateDimmedResults(focusedResult) {
  const allResults = document.querySelectorAll('#results .result');
  allResults.forEach(res => {
    if (focusedResult && res !== focusedResult) {
      res.classList.add('dimmed');
    } else {
      res.classList.remove('dimmed');
    }
  });
}

async function loadSheet() {
  resultsDiv.innerHTML = '<div class="no-result">載入中…</div>'
  try {
    // 嘗試從 Google Sheet 載入資料
    const response = await fetch("https://docs.google.com/spreadsheets/d/1rGPBjCI46dMrVDXGDU6rQM51H1FG4Mt27f_EL0qVvdM/gviz/tq?tqx=out:json")
    const text = await response.text()
    const json = JSON.parse(text.substr(47).slice(0, -2))
    guests = json.table.rows
      .map(row => ({
        name: row.c[0]?.v || '',
        table: row.c[1]?.f ?? row.c[1]?.v ?? '',
        tableName: row.c[2]?.v || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  } catch (e) {
    console.log('Google Sheet 載入失敗，嘗試載入本地 CSV 檔案...');
    try {
      // 如果 Google Sheet 載入失敗，嘗試載入本地 CSV
      const response = await fetch('data/guests.csv');
      const csvText = await response.text();
      const rows = csvText.split('\n').slice(1); // 跳過標題行
      guests = rows
        .filter(row => row.trim()) // 過濾空行
        .map(row => {
          const [name, table, tableName] = row.split(',').map(cell => cell.trim());
          return {
            name: name || '',
            table: table || '',
            tableName: tableName || ''
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    } catch (localError) {
      console.error('本地 CSV 載入也失敗:', localError);
      resultsDiv.innerHTML = '<div class="no-result">無法載入資料，請檢查網路連線或聯絡管理員</div>';
      return;
    }
  }

  total = guests.length;
  summaryDiv.textContent = `共 ${total} 位賓客`;
  resultsDiv.innerHTML = '';

  // 預載所有桌次圖片
  if (guests && guests.length > 0) {
    const uniqueTableNumbers = [...new Set(guests.map(g => g.table).filter(t => t))];
    console.log('準備預載以下桌次圖片:', uniqueTableNumbers);
    uniqueTableNumbers.forEach(tableNum => {
      const img = new Image();
      img.src = 'table/' + tableNum + '.jpg';
    });
  }
}

// 載入 Google Sheet 完成後自動聚焦
window.onload = () => searchInput.focus()

// 輸入框自動全選 (移除或註解此段)
/*
searchInput.addEventListener('focus', () => searchInput.select())
*/

// 支援 Escape 清空
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    resultsDiv.innerHTML = '';
    summaryDiv.textContent = `共 ${total} 位賓客`;
    currentlyFocusedResult = null; // 清除焦點
    updateDimmedResults(null); // 清除淡化
    window.scrollTo({ top: 0, behavior: 'smooth' }); // 改為捲動到頁面最頂部
  }
})

// 搜尋事件
searchInput.addEventListener('input', () => {
  const keyword = searchInput.value.trim()
  resultsDiv.innerHTML = ''
  currentlyFocusedResult = null; // 清除焦點
  updateDimmedResults(null); // 在重新產生結果前清除淡化

  if (keyword === '') {
    summaryDiv.textContent = `共 ${total} 位賓客`
    return
  }
  const filtered = guests.filter(g => g.name.includes(keyword))
  summaryDiv.textContent = `查詢到 ${filtered.length} 筆，共 ${total} 位賓客`
  if (filtered.length === 0) {
    resultsDiv.innerHTML = '<div class="no-result">查無資料，請確認姓名</div>'
    return
  }
  filtered.forEach(g => {
    const div = document.createElement('div')
    div.className = 'result'
    // 點擊自動顯示圖片
    div.addEventListener('click', function (event) {
      // 檢查是否目前已有項目被高亮/展開
      if (currentlyFocusedResult) {
        // 如果是，則本次點擊的唯一作用是「清場」並返回初始列表狀態
        document.querySelectorAll('.image-dropdown.show').forEach(d => d.remove());
        currentlyFocusedResult = null;
        updateDimmedResults(null);
        searchInput.value = ''; // 清空搜尋框文字
        window.scrollTo({ top: 0, behavior: 'smooth' }); // 改為捲動到頁面最頂部
        // 清場後，NGC_EXTRACT_WARNING：此處的註解與程式碼不完全對應
      } else {
        // 如果沒有項目被高亮（即頁面處於初始列表狀態）
        // 則檢查點擊的是否是圖片區域（理論上此時不應存在已展開的圖片）
        if (event.target.closest('.image-dropdown')) {
          return; // 如果意外點到圖片區域，不執行任何操作
        }

        // 點擊的是結果列的文本部分，執行「開啟」邏輯
        const clickedItem = this;
        currentlyFocusedResult = clickedItem;
        updateDimmedResults(clickedItem);

        // 創建並顯示圖片
        const newDropdown = document.createElement('div');
        newDropdown.className = 'image-dropdown show';
        const img = document.createElement('img');
        img.src = 'table/' + g.table + '.jpg'; // 'g' 來自外層 forEach 的閉包
        img.alt = '桌次圖片：' + g.table;

        // 當圖片成功載入後執行捲動
        img.onload = function () {
          // 確保 dropdown 和圖片仍然是預期的一部分才捲動
          if (newDropdown.contains(this) && clickedItem.contains(newDropdown)) {
            clickedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        };

        img.onerror = function () {
          this.alt = '圖片載入失敗：' + g.table;
          if (newDropdown.contains(this)) {
            newDropdown.innerHTML = '<p>無法載入桌次 ' + g.table + ' 的圖片</p>';
          }
          // 即使圖片載入失敗，也嘗試捲動到該項目
          if (clickedItem.contains(newDropdown) || !newDropdown.parentElement) { // 如果 dropdown 還沒被 append 或是已經是 clickedItem 的子元素
            clickedItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        };

        newDropdown.appendChild(img);
        clickedItem.appendChild(newDropdown);
      }
    })
    const textContentWrapper = document.createElement('div');
    textContentWrapper.className = 'result-text-content';
    textContentWrapper.innerHTML = `
      <strong>${highlight(g.name, keyword)}</strong>
      <span class="table-label">桌號：</span>
      <span class="table-number">${g.table}</span>
    `;
    div.appendChild(textContentWrapper);

    resultsDiv.appendChild(div);
  })
})

// 載入 Google Sheet
async function main() {
  try {
    // 嘗試從 Google Sheet 載入資料
    const response = await fetch("https://docs.google.com/spreadsheets/d/1rGPBjCI46dMrVDXGDU6rQM51H1FG4Mt27f_EL0qVvdM/gviz/tq?tqx=out:json")
    const text = await response.text()
    const json = JSON.parse(text.substr(47).slice(0, -2))
    guests = json.table.rows
      .map(row => ({
        name: row.c[0]?.v || '',
        table: row.c[1]?.f ?? row.c[1]?.v ?? '',
        tableName: row.c[2]?.v || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  } catch (e) {
    console.log('Google Sheet 載入失敗，嘗試載入本地 CSV 檔案...');
    try {
      // 如果 Google Sheet 載入失敗，嘗試載入本地 CSV
      const response = await fetch('data/guests.csv');
      const csvText = await response.text();
      const rows = csvText.split('\n').slice(1); // 跳過標題行
      guests = rows
        .filter(row => row.trim()) // 過濾空行
        .map(row => {
          const [name, table, tableName] = row.split(',').map(cell => cell.trim());
          return {
            name: name || '',
            table: table || '',
            tableName: tableName || ''
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    } catch (localError) {
      console.error('本地 CSV 載入也失敗:', localError);
      resultsDiv.innerHTML = '<div class="no-result">無法載入資料，請檢查網路連線或聯絡管理員</div>';
      return;
    }
  }

  total = guests.length;
  summaryDiv.textContent = `共 ${total} 位賓客`;
  resultsDiv.innerHTML = '';

  // 預載所有桌次圖片
  if (guests && guests.length > 0) {
    const uniqueTableNumbers = [...new Set(guests.map(g => g.table).filter(t => t))];
    console.log('準備預載以下桌次圖片:', uniqueTableNumbers);
    uniqueTableNumbers.forEach(tableNum => {
      const img = new Image();
      img.src = 'table/' + tableNum + '.jpg';
    });
  }
}
main()

// 新增：點擊頁面其他地方關閉 dropdown
document.addEventListener('click', function (event) {
  const openDropdown = document.querySelector('.image-dropdown.show')
  if (openDropdown) {
    // 檢查點擊事件的目標是否在任何 .result 元素或其子元素 (包括 dropdown) 之內
    const clickedInsideResultOrDropdown = event.target.closest('.result')

    if (!clickedInsideResultOrDropdown) {
      // 如果點擊發生在所有 .result 元素之外，則關閉 dropdown
      const openDropdown = document.querySelector('.image-dropdown.show'); // 需要重新獲取，因為可能已被移除
      if (openDropdown) openDropdown.remove();

      if (currentlyFocusedResult) { // 確保確實有焦點需要清除
        currentlyFocusedResult = null; // 清除焦點
        updateDimmedResults(null); // 清除淡化狀態
        searchInput.value = ''; // 清空搜尋框文字
        window.scrollTo({ top: 0, behavior: 'smooth' }); // 改為捲動到頁面最頂部
      }
    }
  }
})

// 深色模式切換邏輯 - CodePen Style
const themeToggleCodepen = document.getElementById('theme-toggle-codepen');
const moonOrSunElement = themeToggleCodepen.querySelector('.moon'); // Get the span inside
const bodyElement = document.body;

function applyTheme(theme) {
  if (theme === 'dark') {
    bodyElement.classList.add('dark-mode');
    moonOrSunElement.classList.remove('sun'); // Show moon in dark mode
  } else {
    bodyElement.classList.remove('dark-mode');
    moonOrSunElement.classList.add('sun'); // Show sun in light mode
  }
}

themeToggleCodepen.addEventListener('click', () => {
  const isDarkMode = bodyElement.classList.contains('dark-mode');
  const newTheme = isDarkMode ? 'light' : 'dark';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);
});

// 頁面載入時應用儲存的主題
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  applyTheme(savedTheme);
} else {
  // Default to light theme if no preference is saved
  applyTheme('light');
}

// 新增：頁籤切換功能
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // 移除所有頁籤的 active 類別
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    // 為當前頁籤添加 active 類別
    tab.classList.add('active');
    const tabId = tab.getAttribute('data-tab');
    document.getElementById(tabId).classList.add('active');

    // 如果切換到桌次查詢頁籤，聚焦到桌次搜尋框
    if (tabId === 'table-search') {
      document.getElementById('tableSearch').focus();
    } else {
      document.getElementById('search').focus();
    }
  });
});

// 新增：桌次查詢功能
const tableSearchInput = document.getElementById('tableSearch');
const tableResultsDiv = document.getElementById('tableResults');
const tableSummaryDiv = document.getElementById('tableSummary');

tableSearchInput.addEventListener('input', () => {
  const tableNumber = tableSearchInput.value.trim();
  tableResultsDiv.innerHTML = '';

  if (!tableNumber) {
    tableSummaryDiv.textContent = '';
    return;
  }

  if (!/^\d+$/.test(tableNumber)) {
    tableSummaryDiv.textContent = '請輸入有效的桌次號碼';
    return;
  }

  const tableGuests = guests.filter(g => g.table === tableNumber);

  if (tableGuests.length === 0) {
    tableSummaryDiv.textContent = `找不到桌次 ${tableNumber} 的賓客`;
    return;
  }

  // 取得桌號別名（從第一個賓客資料中取得）
  const tableName = tableGuests[0].tableName;

  // 計算總桌數（不重複的桌號數量）
  const totalTables = [...new Set(guests.map(g => g.table).filter(t => t))].length;
  tableSummaryDiv.textContent = `第 ${tableNumber} 桌（共 ${tableGuests.length} 位賓客），總共 ${totalTables} 桌`;

  // 新增桌次圖片和別名顯示
  const tableImageDiv = document.createElement('div');
  tableImageDiv.className = 'result';
  tableImageDiv.innerHTML = `
    <div class="result-text-content">
      <span class="table-name">${tableName}</span>
    </div>
    <div class="image-dropdown show">
      <img src="table/${tableNumber}.jpg" alt="桌次圖片：${tableNumber}" onerror="this.parentElement.innerHTML='<p>無法載入桌次 ${tableNumber} 的圖片</p>'">
    </div>
  `;
  tableResultsDiv.appendChild(tableImageDiv);

  // 顯示賓客列表
  tableGuests.forEach(guest => {
    const div = document.createElement('div');
    div.className = 'result';

    const textContentWrapper = document.createElement('div');
    textContentWrapper.className = 'result-text-content';
    textContentWrapper.innerHTML = `<strong>${guest.name}</strong><span class="table-label">桌號：</span><span class="table-number">${guest.table}</span>`;

    div.appendChild(textContentWrapper);
    tableResultsDiv.appendChild(div);
  });
});

// 支援桌次查詢的 Escape 清空
tableSearchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    tableSearchInput.value = '';
    tableResultsDiv.innerHTML = '';
    tableSummaryDiv.textContent = '';
  }
});
