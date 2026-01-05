/*
 * NFT 관리 대시보드 - 유틸리티 함수
 * 보안 강화 및 에러 핸들링
 */

// ============================================================
//                    네트워크 설정
// ============================================================
const NETWORKS = {
  "1": {
    name: "ethereum",
    explorer: "https://etherscan.io",
    chainName: "Ethereum Mainnet",
    nativeCurrency: "ETH",
    chainIdHex: "0x1",
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
    isTestnet: false
  },
  "11155111": {
    name: "sepolia",
    explorer: "https://sepolia.etherscan.io",
    chainName: "Sepolia Testnet",
    nativeCurrency: "ETH",
    chainIdHex: "0xaa36a7",
    rpcUrls: ["https://rpc.sepolia.org/"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    isTestnet: true
  }
};

// ============================================================
//                    검증 함수
// ============================================================

/**
 * 이더리움 주소 검증
 * @param {string} address - 검증할 주소
 * @returns {boolean}
 */
function isValidEthereumAddress(address) {
  if (!address || typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 숫자 유효성 검증 (범위 체크 포함)
 * @param {any} amount - 검증할 숫자
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {boolean}
 */
function isValidAmount(amount, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(amount);
  return !isNaN(num) && 
         Number.isFinite(num) && 
         num >= min && 
         num <= max;
}

/**
 * 정수 유효성 검증
 * @param {any} amount - 검증할 정수
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {boolean}
 */
function isValidInteger(amount, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const num = Number(amount);
  return !isNaN(num) && 
         Number.isInteger(num) && 
         num >= min && 
         num <= max;
}

/**
 * URI 형식 검증
 * @param {string} uri - 검증할 URI
 * @returns {boolean}
 */
function isValidURI(uri) {
  if (!uri || typeof uri !== 'string') return false;
  try {
    new URL(uri);
    return true;
  } catch {
    return uri.startsWith('ipfs://') || uri.startsWith('ar://');
  }
}

// ============================================================
//                    포맷팅 함수
// ============================================================

/**
 * Wei를 ETH로 변환 (표시용)
 * @param {BigNumber|string} wei - Wei 단위
 * @returns {string}
 */
function formatEther(wei) {
  try {
    return ethers.utils.formatEther(wei);
  } catch (e) {
    console.error("formatEther 오류:", e);
    return "0";
  }
}

/**
 * ETH를 Wei로 변환
 * @param {string|number} eth - ETH 단위
 * @returns {BigNumber}
 */
function parseEther(eth) {
  try {
    return ethers.utils.parseEther(eth.toString());
  } catch (e) {
    console.error("parseEther 오류:", e);
    throw new Error("숫자 형식이 올바르지 않습니다.");
  }
}

/**
 * 주소 단축 표시 (0x1234...5678)
 * @param {string} address - 전체 주소
 * @param {number} startLen - 앞부분 길이
 * @param {number} endLen - 뒷부분 길이
 * @returns {string}
 */
function shortenAddress(address, startLen = 6, endLen = 4) {
  if (!isValidEthereumAddress(address)) return address;
  return `${address.slice(0, startLen)}...${address.slice(-endLen)}`;
}

/**
 * 숫자를 천 단위 콤마로 포맷팅
 * @param {number|string} num - 숫자
 * @returns {string}
 */
function formatNumber(num) {
  return Number(num).toLocaleString('ko-KR');
}

// ============================================================
//                    에러 핸들링
// ============================================================

/**
 * 사용자 친화적 에러 메시지 생성
 * @param {Error} e - 에러 객체
 * @returns {string}
 */
function friendlyError(e) {
  try {
    // 사용자 거부
    if (
      e &&
      (e.code === 4001 ||
        e.code === "ACTION_REJECTED" ||
        (e.message || "").toLowerCase().includes("user rejected"))
    ) {
      return "트랜잭션을 취소하였습니다.";
    }

    const msg = e?.data?.message || e?.error?.message || e?.message || String(e);

    // 타임아웃
    if (
      /timeout|timed out|could not detect network|missing response|failed to fetch|network request failed/i.test(msg)
    ) {
      return "RPC 서버 응답 대기 중 타임아웃이 발생했습니다.\n\n트랜잭션은 전송되었을 수 있으니 Explorer에서 확인해주세요.";
    }

    // 컨트랙트 찾기 실패
    if (
      /Returned values aren't valid|did it run Out of Gas|not using the correct ABI|requesting data from a block number that does not exist|node which is not fully synced/i.test(msg)
    ) {
      return "현재 네트워크에서 컨트랙트를 찾을 수 없습니다. 네트워크와 컨트랙트 주소를 확인해주세요.";
    }

    // 컨트랙트 Revert 에러
    if (/execution reverted|call exception|contract call failed/i.test(msg)) {
      const revertMatch = msg.match(/reverted with reason string ['"]([^'"]+)['"]/i);
      if (revertMatch) return `컨트랙트 실행 거부: ${revertMatch[1]}`;

      // Custom Errors 매핑
      if (/InvalidAdmin/i.test(msg)) return "잘못된 관리자 주소입니다.";
      if (/InvalidRoyaltyReceiver/i.test(msg)) return "잘못된 로열티 수신자 주소입니다.";
      if (/InvalidWithdrawalAddress/i.test(msg)) return "잘못된 출금 주소입니다.";
      if (/InvalidRoyalty/i.test(msg)) return "로열티 비율이 10%를 초과할 수 없습니다.";
      if (/UriEmpty/i.test(msg)) return "URI가 비어있습니다.";
      if (/MintPaused/i.test(msg)) return "민팅이 일시정지되었습니다.";
      if (/InvalidRecipient/i.test(msg)) return "잘못된 수신자 주소입니다.";
      if (/MintAmountZero/i.test(msg)) return "민팅 수량은 0보다 커야 합니다.";
      if (/MintAmountExceedsLimit/i.test(msg)) return "민팅 수량이 제한을 초과했습니다.";
      if (/SaleCapNotConfigured/i.test(msg)) return "판매 한도가 설정되지 않았습니다.";
      if (/SaleRangeExceeded/i.test(msg)) return "현재 판매 범위를 초과했습니다.";
      if (/MaxSupplyExceeded/i.test(msg)) return "최대 발행량을 초과했습니다.";
      if (/WhitelistMintNotStarted/i.test(msg)) return "화이트리스트 민팅이 시작되지 않았습니다.";
      if (/PublicMintNotStarted/i.test(msg)) return "퍼블릭 민팅이 시작되지 않았습니다.";
      if (/NotWhitelisted/i.test(msg)) return "화이트리스트에 등록되지 않았습니다.";
      if (/IncorrectETHAmount/i.test(msg)) return "전송한 ETH 금액이 올바르지 않습니다.";
      if (/EmptyList/i.test(msg)) return "목록이 비어있습니다.";
      if (/TooManyAccounts/i.test(msg)) return "계정이 너무 많습니다 (최대 100개).";
      if (/ZeroAddress/i.test(msg)) return "주소가 0x0입니다.";
      if (/EndTokenIdInvalid/i.test(msg)) return "종료 토큰 ID가 유효하지 않습니다.";
      if (/EndTokenIdExceedsMaxSupply/i.test(msg)) return "종료 토큰 ID가 최대 발행량을 초과합니다.";
      if (/CannotDecreaseEndTokenId/i.test(msg)) return "종료 토큰 ID를 감소시킬 수 없습니다.";
      if (/CannotDecreaseBelowMinted/i.test(msg)) return "이미 발행된 수량 이하로 줄일 수 없습니다.";
      if (/CannotDecreaseBelowSaleCap/i.test(msg)) return "판매 한도 이하로 줄일 수 없습니다.";
      if (/TransfersPaused/i.test(msg)) return "전송이 일시정지되었습니다.";
      if (/WithdrawalAddressNotSet/i.test(msg)) return "출금 주소가 설정되지 않았습니다.";
      if (/NoBalance/i.test(msg)) return "잔액이 없습니다.";
      if (/WithdrawalFailed/i.test(msg)) return "출금에 실패했습니다.";

      return "컨트랙트 호출에 실패했습니다. 입력값과 권한을 확인해주세요.";
    }

    // 가스 부족
    if (/insufficient funds/i.test(msg) || e?.code === "INSUFFICIENT_FUNDS") {
      return `지갑 잔액(ETH)이 부족합니다. 가스비를 위한 ETH가 필요합니다.`;
    }

    // 논스 오류
    if (/nonce too low/i.test(msg)) {
      return "논스가 낮습니다. 잠시 후 다시 시도해주세요.";
    }
    
    if (/replacement (fee|underpriced)/i.test(msg)) {
      return "가스 가격/한도를 높여 재시도하세요.";
    }

    // 가스 추정 실패
    if (
      e?.code === "UNPREDICTABLE_GAS_LIMIT" ||
      /gas required exceeds allowance|always failing transaction/i.test(msg)
    ) {
      return "가스 추정에 실패했습니다. 입력값, 권한, 컨트랙트 상태를 확인해주세요.";
    }

    // 주소 형식 오류
    if (/invalid address/i.test(msg)) return "잘못된 주소 형식입니다.";
    
    // 숫자 형식 오류
    if (/invalid (bignumber|number|uint)/i.test(msg)) {
      return "숫자 형식이 올바르지 않습니다.";
    }
    
    // 네트워크 오류
    if (/network error|chain|wrong network|unsupported chain id/i.test(msg)) {
      return "네트워크 오류입니다.";
    }

    return "오류: " + msg;
  } catch (_) {
    return "알 수 없는 오류가 발생했습니다.";
  }
}

// ============================================================
//                    디바이스 감지
// ============================================================

/**
 * 현재 디바이스 종류 감지
 * @returns {string} "iOS" | "Android" | "Desktop"
 */
function detectDevice() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "iOS";
  if (/android/i.test(ua)) return "Android";
  return "Desktop";
}

/**
 * MetaMask 설치 페이지로 리다이렉트
 */
function redirectToMetaMask() {
  const device = detectDevice();
  if (device === "iOS") {
    window.location.href = "https://apps.apple.com/app/metamask/id1438144202";
  } else if (device === "Android") {
    window.location.href = "https://play.google.com/store/apps/details?id=io.metamask";
  } else {
    window.location.href = "https://metamask.io/download/";
  }
}

/**
 * MetaMask 브라우저에서 열기
 */
function openInMetaMaskBrowser() {
  const device = detectDevice();
  const currentUrl = window.location.href;
  
  if (device === "iOS" || device === "Android") {
    const metamaskDeepLink = `https://metamask.app.link/dapp/${currentUrl.replace(/^https?:\/\//, "")}`;
    window.location.href = metamaskDeepLink;
    
    setTimeout(() => {
      redirectToMetaMask();
    }, 3000);
  } else {
    redirectToMetaMask();
  }
}

// ============================================================
//                    DOM 유틸리티
// ============================================================

/**
 * 요소의 텍스트 설정
 * @param {string} id - 요소 ID
 * @param {string} value - 설정할 텍스트
 */
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

/**
 * 요소의 HTML 설정 (XSS 주의)
 * @param {string} id - 요소 ID
 * @param {string} html - 설정할 HTML
 */
function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/**
 * 요소 표시/숨김
 * @param {string} id - 요소 ID
 * @param {boolean} show - 표시 여부
 */
function toggleElement(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? "block" : "none";
}

// ============================================================
//                    네트워크 유틸리티
// ============================================================

/**
 * 네트워크 정보 가져오기
 * @param {number} chainId - 체인 ID
 * @returns {object}
 */
function getNetworkInfo(chainId) {
  return NETWORKS[chainId.toString()] || NETWORKS["1"];
}

/**
 * Explorer URL 가져오기
 * @param {number} chainId - 체인 ID
 * @returns {string}
 */
function getExplorerUrl(chainId) {
  return getNetworkInfo(chainId).explorer;
}

/**
 * 트랜잭션 Explorer 링크 생성
 * @param {string} txHash - 트랜잭션 해시
 * @param {number} chainId - 체인 ID
 * @returns {string}
 */
function getTxLink(txHash, chainId) {
  return `${getExplorerUrl(chainId)}/tx/${txHash}`;
}

/**
 * 주소 Explorer 링크 생성
 * @param {string} address - 주소
 * @param {number} chainId - 체인 ID
 * @returns {string}
 */
function getAddressLink(address, chainId) {
  return `${getExplorerUrl(chainId)}/address/${address}`;
}

/**
 * 토큰 Explorer 링크 생성
 * @param {string} contractAddress - 컨트랙트 주소
 * @param {number} tokenId - 토큰 ID
 * @param {number} chainId - 체인 ID
 * @returns {string}
 */
function getTokenLink(contractAddress, tokenId, chainId) {
  return `${getExplorerUrl(chainId)}/token/${contractAddress}?a=${tokenId}`;
}

// ============================================================
//                    로컬 스토리지
// ============================================================

/**
 * 로컬 스토리지에 저장
 * @param {string} key - 키
 * @param {any} value - 값
 */
function saveToStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("로컬 스토리지 저장 실패:", e);
  }
}

/**
 * 로컬 스토리지에서 불러오기
 * @param {string} key - 키
 * @param {any} defaultValue - 기본값
 * @returns {any}
 */
function loadFromStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error("로컬 스토리지 불러오기 실패:", e);
    return defaultValue;
  }
}

// ============================================================
//                    시간 유틸리티
// ============================================================

/**
 * 타임스탬프를 사람이 읽기 쉬운 형식으로 변환
 * @param {number} timestamp - Unix 타임스탬프
 * @returns {string}
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 현재 시간 (Unix 타임스탬프)
 * @returns {number}
 */
function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// ============================================================
//                    배열 유틸리티
// ============================================================

/**
 * 배열을 청크로 나누기
 * @param {Array} array - 원본 배열
 * @param {number} size - 청크 크기
 * @returns {Array[]}
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 배열 중복 제거
 * @param {Array} array - 원본 배열
 * @returns {Array}
 */
function uniqueArray(array) {
  return [...new Set(array)];
}

// ============================================================
//                    디버깅 유틸리티
// ============================================================

/**
 * 프로덕션 환경에서만 로그 출력
 * @param {...any} args - 로그 인자
 */
function debugLog(...args) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[DEBUG]', ...args);
  }
}

/**
 * 에러 로그 (항상 출력)
 * @param {...any} args - 에러 인자
 */
function errorLog(...args) {
  console.error('[ERROR]', ...args);
}
