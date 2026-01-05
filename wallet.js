/*
 * NFT 관리 대시보드 - 지갑 연결 및 네트워크 관리
 * 보안 강화 및 상태 관리
 */

// ============================================================
//                    전역 변수
// ============================================================
let Network = 1; // 기본값: Ethereum Mainnet
let WalletAddress = "";
let web3 = null;
let ethersProvider = null;
let ethersSigner = null;

// 트랜잭션 처리 중 플래그
let isProcessing = false;
let updateInProgress = false;

// ============================================================
//                    Provider 초기화
// ============================================================

/**
 * Web3 및 Ethers Provider 재구성
 */
function rebuildProviders() {
  if (!window.ethereum) {
    errorLog("MetaMask(ethereum)가 감지되지 않습니다.");
    ethersProvider = null;
    ethersSigner = null;
    web3 = null;
    return false;
  }

  let ok = true;

  // 1) ethers는 반드시 먼저 잡는다 (대부분의 기능이 ethers 기반)
  try {
    if (typeof ethers === "undefined") {
      throw new Error("ethers 라이브러리가 로드되지 않았습니다.");
    }
    // "any"를 주면 chainChanged 대응이 더 안정적
    ethersProvider = new ethers.providers.Web3Provider(window.ethereum, "any");
    ethersSigner = ethersProvider.getSigner();
  } catch (e) {
    ok = false;
    errorLog("ethersProvider 초기화 실패:", e);
    ethersProvider = null;
    ethersSigner = null;
  }

  // 2) web3는 선택 (없어도 ethers로 조회 가능하게 만들 예정)
  try {
    if (typeof Web3 !== "undefined") {
      web3 = new Web3(window.ethereum);
    } else {
      web3 = null;
      debugLog("Web3 라이브러리가 없어 web3는 비활성화됩니다.");
    }
  } catch (e) {
    web3 = null;
    errorLog("web3 초기화 실패(무시 가능):", e);
  }

  return ok;
}

// ============================================================
//                    지갑 연결
// ============================================================

/**
 * MetaMask 지갑 연결
 */
async function connectWallet() {
  try {
    // MetaMask 설치 확인
    if (typeof window.ethereum === "undefined") {
      alert("MetaMask가 설치되지 않았습니다.\n\n모바일의 경우 MetaMask 브라우저를 사용해주세요.");
      openInMetaMaskBrowser();
      return;
    }

    // Provider 초기화
    rebuildProviders();

    // 계정 요청
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });

    if (accounts.length === 0) {
      alert("계정을 찾을 수 없습니다. MetaMask를 확인해주세요.");
      return;
    }

    WalletAddress = accounts[0];
    
    // 현재 체인 ID 확인
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    const decimalChainId = parseInt(chainId, 16);
    
    // 지원하는 네트워크인지 확인
    if (!NETWORKS[decimalChainId.toString()]) {
      alert(`지원하지 않는 네트워크입니다.\n\n이더리움 메인넷 또는 세폴리아 테스트넷을 선택해주세요.`);
      return;
    }
    
    Network = decimalChainId;

    // UI 업데이트
    await updateWalletInfo();
    await loadContractState();
    
    updateUIState(true);
    setupExplorerLinks();
    updateNetworkDisplay();
    
    // 지갑 연결 버튼 변경
    const walletBtn = document.querySelector(".btn-connect-wallet");
    if (walletBtn) {
      walletBtn.innerText = "✅ 지갑 연결됨";
      walletBtn.onclick = disconnectWallet;
    }

    debugLog("지갑 연결 성공:", WalletAddress, "Network:", Network);
    
  } catch (e) {
    errorLog("지갑 연결 실패:", e);
    alert("지갑 연결에 실패했습니다.\n\n" + friendlyError(e));
  }
}

/**
 * 지갑 연결 해제
 */
function disconnectWallet() {
  WalletAddress = "";
  web3 = null;
  ethersProvider = null;
  ethersSigner = null;
  
  document.getElementById("walletAddress").innerText = "연결되지 않음";
  document.getElementById("walletBalance").innerText = "-";
  document.getElementById("nftBalance").innerText = "-";
  document.getElementById("walletRole").innerText = "연결되지 않음";
  document.getElementById("walletRole").className = "wallet-role";
  
  updateUIState(false);
  
  const walletBtn = document.querySelector(".btn-connect-wallet");
  if (walletBtn) {
    walletBtn.innerText = "🔗 지갑 연결 (MetaMask)";
    walletBtn.onclick = connectWallet;
  }
  
  debugLog("지갑 연결 해제");
}

/**
 * 지갑 연결 상태 확인
 */
async function ensureConnected() {
  if (!window.ethereum || !ethersProvider || !ethersSigner || !WalletAddress) {
    alert("먼저 지갑을 연결해주세요.");
    throw new Error("WALLET_NOT_CONNECTED");
  }
}

// ============================================================
//                    네트워크 관리
// ============================================================

/**
 * 네트워크 선택
 * @param {number} targetChainId - 대상 체인 ID
 */
async function selectNetwork(targetChainId) {
  const networkInfo = NETWORKS[targetChainId.toString()];
  if (!networkInfo) {
    alert("지원하지 않는 네트워크입니다.");
    return;
  }

  // UI 버튼 먼저 반영
  document.querySelectorAll(".network-btn").forEach((btn) => btn.classList.remove("active"));
  const activeBtn = document.querySelector(`.network-btn[data-chain-id="${targetChainId}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  // 메타마스크 네트워크 전환 시도 (연결 전이어도 보통 프롬프트로 진행됨)
  if (window.ethereum) {
    const switched = await switchNetwork(targetChainId);
    if (!switched) {
      // 실패했으면 UI상 선택값도 실제 네트워크로 되돌리는 게 안전
      try {
        const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
        const realId = parseInt(chainIdHex, 16);
        Network = NETWORKS[realId.toString()] ? realId : targetChainId;
      } catch {
        Network = targetChainId;
      }
    }
  }

  // 실제 체인으로 동기화
  try {
    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
    const realId = parseInt(chainIdHex, 16);
    if (NETWORKS[realId.toString()]) Network = realId;
    else Network = targetChainId;
  } catch {
    Network = targetChainId;
  }

  rebuildProviders();
  updateNetworkDisplay();
  setupExplorerLinks();

  if (WalletAddress) {
    await updateWalletInfo();
    await loadContractState();
  }

  debugLog("네트워크 선택 완료:", getNetworkInfo(Network).chainName);
}

/**
 * MetaMask 네트워크 전환
 * @param {number} targetChainId - 대상 체인 ID
 * @returns {boolean} 성공 여부
 */
async function switchNetwork(targetChainId) {
  const networkInfo = NETWORKS[targetChainId.toString()];
  if (!networkInfo) {
    alert("지원하지 않는 네트워크입니다.");
    return false;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: networkInfo.chainIdHex }]
    });
    return true;
  } catch (switchError) {
    // 네트워크가 추가되지 않은 경우 (4902)
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: networkInfo.chainIdHex,
              chainName: networkInfo.chainName,
              nativeCurrency: {
                name: networkInfo.nativeCurrency,
                symbol: networkInfo.nativeCurrency,
                decimals: 18
              },
              rpcUrls: networkInfo.rpcUrls,
              blockExplorerUrls: networkInfo.blockExplorerUrls
            }
          ]
        });
        return true;
      } catch (addError) {
        errorLog("네트워크 추가 실패:", addError);
        alert("네트워크 추가에 실패했습니다.\n\n" + friendlyError(addError));
        return false;
      }
    } else {
      errorLog("네트워크 전환 실패:", switchError);
      alert("네트워크 전환에 실패했습니다.\n\n" + friendlyError(switchError));
      return false;
    }
  }
}

/**
 * 올바른 네트워크인지 확인 및 전환
 */
async function checkAndSwitchNetwork() {
  if (!window.ethereum) return;

  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    const currentChainId = parseInt(chainId, 16);

    if (currentChainId !== Network) {
      debugLog(`현재 네트워크(${currentChainId})와 선택된 네트워크(${Network})가 다릅니다. 전환 시도...`);
      await switchNetwork(Network);
    }
  } catch (e) {
    errorLog("네트워크 확인 실패:", e);
  }
}

/**
 * 네트워크 표시 업데이트
 */
function updateNetworkDisplay() {
  const networkInfo = getNetworkInfo(Network);
  const displayEl = document.getElementById("currentNetworkDisplay");
  
  if (displayEl) {
    const icon = networkInfo.isTestnet ? "⚠️" : "🌐";
    const badge = networkInfo.isTestnet ? '<span class="testnet-badge">테스트</span>' : '';
    
    displayEl.innerHTML = `
      <span style="font-weight:600;color:#00ffcc;">${icon} 네트워크:</span>
      <span style="font-weight:700;color:#fff;">${networkInfo.chainName}</span>
      ${badge}
    `;
  }
}

// ============================================================
//                    지갑 정보 업데이트
// ============================================================

/**
 * 지갑 정보 업데이트 (잔액, NFT 보유량, 권한)
 */
async function updateWalletInfo() {
  if (!WalletAddress) return;

  if (!ethersProvider) rebuildProviders();

  const addrEl = document.getElementById("walletAddress");
  const balEl  = document.getElementById("walletBalance");
  const nftEl  = document.getElementById("nftBalance");
  const roleEl = document.getElementById("walletRole");

  // 주소는 무조건 표시
  if (addrEl) addrEl.innerText = shortenAddress(WalletAddress);

  if (updateInProgress) return;
  updateInProgress = true;

  try {
    // 1) 네이티브 잔고 (여기 실패해도 아래 계속 감)
    if (balEl) balEl.innerText = "조회중...";
    if (!ethersProvider) {
      if (balEl) balEl.innerText = "-";
    } else {
      try {
        // ✅ 네트워크 감지 워밍업
        await ethersProvider.getNetwork();

        const balance = await ethersProvider.getBalance(WalletAddress);
        const balanceETH = formatEther(balance);
        const sym = getNetworkInfo(Network).nativeCurrency || "ETH";
        if (balEl) balEl.innerText = `${parseFloat(balanceETH).toFixed(4)} ${sym}`;
      } catch (e) {
        errorLog("네이티브 잔고 조회 실패:", e);
        if (balEl) balEl.innerText = "조회 실패";
      }
    }

    // 2) 컨트랙트 주소
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const isZero =
      !CONTRACT_ADDRESS ||
      CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000";

    if (isZero) {
      if (nftEl) nftEl.innerText = "컨트랙트 미설정";
      if (roleEl) {
        roleEl.innerText = "컨트랙트 미설정";
        roleEl.className = "wallet-role";
      }
      return;
    }

    // 3) NFT 보유량 + 권한
    if (!ethersProvider) {
      if (nftEl) nftEl.innerText = "-";
      if (roleEl) {
        roleEl.innerText = "연결되지 않음";
        roleEl.className = "wallet-role";
      }
      return;
    }

    if (nftEl) nftEl.innerText = "조회중...";
    if (roleEl) {
      roleEl.innerText = "조회중...";
      roleEl.className = "wallet-role";
    }

    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersProvider);

      const nftBalance = await contract.balanceOf(WalletAddress);
      if (nftEl) nftEl.innerText = `${nftBalance.toString()} 개`;

      await updateWalletRole(contract);
    } catch (e) {
      errorLog("NFT/권한 조회 실패:", e);
      if (nftEl) nftEl.innerText = "조회 실패";
      if (roleEl) {
        roleEl.innerText = "알 수 없음";
        roleEl.className = "wallet-role";
      }
    }
  } finally {
    updateInProgress = false;
  }
}

/**
 * 지갑 권한 확인 및 표시
 * @param {Contract} contract - NFT 컨트랙트 인스턴스
 */
async function updateWalletRole(contract) {
  try {
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    const OPERATOR_ROLE = await contract.OPERATOR_ROLE();
    
    const isAdmin = await contract.hasRole(DEFAULT_ADMIN_ROLE, WalletAddress);
    const isOperator = await contract.hasRole(OPERATOR_ROLE, WalletAddress);
    
    const roleEl = document.getElementById("walletRole");
    
    if (isAdmin) {
      roleEl.innerText = "👑 관리자 (Admin)";
      roleEl.className = "wallet-role admin";
    } else if (isOperator) {
      roleEl.innerText = "⚙️ 운영자 (Operator)";
      roleEl.className = "wallet-role operator";
    } else {
      roleEl.innerText = "👤 일반 사용자";
      roleEl.className = "wallet-role normal";
    }
  } catch (e) {
    errorLog("권한 확인 실패:", e);
    document.getElementById("walletRole").innerText = "알 수 없음";
    document.getElementById("walletRole").className = "wallet-role";
  }
}

// ============================================================
//                    UI 상태 관리
// ============================================================

/**
 * UI 버튼 및 링크 활성화/비활성화
 * @param {boolean} isConnected - 연결 상태
 */
function updateUIState(isConnected) {
  const buttons = document.querySelectorAll("button:not(.btn-connect-wallet):not(.network-btn)");
  const links = document.querySelectorAll(".explorer-links a");
  const body = document.body;

  buttons.forEach((btn) => {
    btn.disabled = !isConnected;
    btn.style.cursor = isConnected ? "pointer" : "not-allowed";
    btn.style.opacity = isConnected ? "1" : "0.5";
  });

  links.forEach((link) => {
    link.style.pointerEvents = isConnected ? "auto" : "none";
    link.style.cursor = isConnected ? "pointer" : "not-allowed";
    link.style.opacity = isConnected ? "1" : "0.5";
  });

  if (isConnected) {
    body.classList.remove("wallet-not-connected");
  } else {
    body.classList.add("wallet-not-connected");
  }
}

/**
 * Explorer 링크 설정
 */
function setupExplorerLinks() {
  const CONTRACT_ADDRESS = getContractAddress(Network);
  const explorerUrl = getExplorerUrl(Network);
  
  // 컨트랙트 링크
  const contractLink = document.getElementById("explorerContract");
  if (contractLink && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    contractLink.href = `${explorerUrl}/address/${CONTRACT_ADDRESS}`;
  }
  
  // 토큰 트래커 링크
  const tokenLink = document.getElementById("explorerToken");
  if (tokenLink && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    tokenLink.href = `${explorerUrl}/token/${CONTRACT_ADDRESS}`;
  }
  
  // 홀더 링크
  const holderLink = document.getElementById("explorerHolders");
  if (holderLink && CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
    holderLink.href = `${explorerUrl}/token/${CONTRACT_ADDRESS}#balances`;
  }
}

// ============================================================
//                    이벤트 리스너 설정
// ============================================================

/**
 * MetaMask 이벤트 리스너 설정
 */
function setupMetaMaskListeners() {
  if (!window.ethereum) return;

  // 네트워크 변경 감지
  window.ethereum.on("chainChanged", async (chainId) => {
    const decimalChainId = parseInt(chainId, 16);
    
    if (NETWORKS[decimalChainId.toString()]) {
      Network = decimalChainId;
      
      // 버튼 UI 업데이트
      document.querySelectorAll(".network-btn").forEach((btn) => {
        btn.classList.remove("active");
      });
      const activeBtn = document.querySelector(`.network-btn[data-chain-id="${decimalChainId}"]`);
      if (activeBtn) activeBtn.classList.add("active");
      
      rebuildProviders();
      updateNetworkDisplay();
      setupExplorerLinks();
      
      if (WalletAddress) {
        await updateWalletInfo();
        await loadContractState();
      }
      
      debugLog("네트워크 변경됨:", decimalChainId);
    } else {
      alert("지원하지 않는 네트워크로 변경되었습니다.\n\n이더리움 메인넷 또는 세폴리아 테스트넷을 선택해주세요.");
    }
  });

  // 계정 변경 감지
  window.ethereum.on("accountsChanged", async (accounts) => {
    if (accounts.length === 0) {
      // 연결 해제됨
      disconnectWallet();
    } else if (accounts[0] !== WalletAddress) {
      // 다른 계정으로 변경됨
      WalletAddress = accounts[0];
      debugLog("계정 변경됨:", WalletAddress);
      
      await updateWalletInfo();
      await loadContractState();
    }
  });
}

// ============================================================
//                    초기화
// ============================================================

/**
 * 페이지 로드 시 초기화
 */
document.addEventListener("DOMContentLoaded", async () => {
  // MetaMask 미설치 경고
  if (typeof window.ethereum === "undefined") {
    const device = detectDevice();
    const walletSection = document.querySelector(".wallet-section");
    
    if (walletSection) {
      const warningDiv = document.createElement("div");
      warningDiv.style.cssText = `
        background: rgba(255,107,107,0.1);
        border: 2px solid #ff6b6b;
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 15px;
        text-align: center;
      `;

      let buttonText = device === "iOS"
        ? "App Store에서 MetaMask 다운로드"
        : device === "Android"
        ? "Play Store에서 MetaMask 다운로드"
        : "MetaMask 설치하기";

      warningDiv.innerHTML = `
        <h3 style="color:#ff6b6b;margin:0 0 10px 0;">⚠️ MetaMask가 설치되지 않았습니다</h3>
        <p style="margin:10px 0;">이 dApp을 사용하려면 MetaMask가 필요합니다.</p>
        <button onclick="redirectToMetaMask()" style="background:#f09433;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;margin:5px;">
          🦊 ${buttonText}
        </button>
        ${device !== "Desktop" ? `
          <button onclick="openInMetaMaskBrowser()" style="background:#00d395;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;margin:5px;">
            🌐 MetaMask 브라우저로 열기
          </button>
        ` : ""}
      `;

      walletSection.insertBefore(warningDiv, walletSection.firstChild);
    }
  } else {
    // MetaMask 이벤트 리스너 설정
    setupMetaMaskListeners();
  }

  // 초기 UI 상태
  updateUIState(false);
  updateNetworkDisplay();
  
  // 기본 네트워크 버튼 활성화
  const defaultBtn = document.querySelector('.network-btn[data-chain-id="1"]');
  if (defaultBtn) defaultBtn.classList.add("active");
  
  debugLog("대시보드 초기화 완료");
});
