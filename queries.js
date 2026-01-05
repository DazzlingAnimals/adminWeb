/*
 * NFT 관리 대시보드 - 권한 관리 및 조회 함수
 * 운영자 추가/삭제, 화이트리스트 조회, 컨트랙트 상태 조회
 */

// ============================================================
//                    권한 관리
// ============================================================

function resetDashboard(reasonText = "컨트랙트 미설정") {
  const ids = [
    "ds_name","ds_symbol","ds_totalSupply","ds_totalMinted",
    "ds_maxSupply","ds_maxMintAmount","ds_maxWhitelistBatchSize","ds_maxOperatorMintAmount",
    "ds_paused","ds_whitelistStart","ds_publicStart","ds_whitelistCost","ds_publicCost",
    "ds_saleEndTokenId","ds_withdrawalAddress","ds_contractBalance"
  ];

  ids.forEach((id) => setText(id, "-"));

  // 대시보드에 이유를 보여주고 싶으면 이름칸에 표시 (선택)
  setText("ds_name", reasonText);

  // 체크박스도 안전하게 초기화
  const pauseCheckbox = document.getElementById("pauseCheckbox");
  if (pauseCheckbox) pauseCheckbox.checked = false;

  const whitelistStartCheckbox = document.getElementById("quickWhitelistStart");
  if (whitelistStartCheckbox) whitelistStartCheckbox.checked = false;

  const publicStartCheckbox = document.getElementById("quickPublicStart");
  if (publicStartCheckbox) publicStartCheckbox.checked = false;
}

function getReadContract() {
  const CONTRACT_ADDRESS = getContractAddress(Network);
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("컨트랙트 주소가 설정되지 않았습니다.");
  }
  if (!ethersProvider) rebuildProviders();
  if (!ethersProvider) throw new Error("Provider 초기화 실패(ethersProvider 없음)");
  return new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersProvider);
}

/**
 * 운영자 권한 부여
 */
async function grantOperatorRole() {
  await ensureConnected();
  
  if (isProcessing) {
    alert("트랜잭션 처리 중입니다...");
    return;
  }
  
  const button = event.target;
  const originalText = button.innerText;
  
  isProcessing = true;
  button.disabled = true;
  button.innerText = "⏳ 처리 중...";
  
  try {
    await checkAndSwitchNetwork();
    
    const address = document.getElementById("operatorAddress").value.trim();
    
    // 입력 검증
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // OPERATOR_ROLE 가져오기
    const OPERATOR_ROLE = await contract.OPERATOR_ROLE();
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.grantRole(OPERATOR_ROLE, address);
    
    // 트랜잭션 전송
    const tx = await contract.grantRole(OPERATOR_ROLE, address, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n운영자 권한 부여\n주소: ${shortenAddress(address)}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 운영자 권한 부여 완료!\n\n주소: ${shortenAddress(address)}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    document.getElementById("operatorAddress").value = "";
    
  } catch (e) {
    errorLog("운영자 권한 부여 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 운영자 권한 제거
 */
async function revokeOperatorRole() {
  await ensureConnected();
  
  if (isProcessing) {
    alert("트랜잭션 처리 중입니다...");
    return;
  }
  
  const button = event.target;
  const originalText = button.innerText;
  
  isProcessing = true;
  button.disabled = true;
  button.innerText = "⏳ 처리 중...";
  
  try {
    await checkAndSwitchNetwork();
    
    const address = document.getElementById("revokeOperatorAddress").value.trim();
    
    // 입력 검증
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // OPERATOR_ROLE 가져오기
    const OPERATOR_ROLE = await contract.OPERATOR_ROLE();
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.revokeRole(OPERATOR_ROLE, address);
    
    // 트랜잭션 전송
    const tx = await contract.revokeRole(OPERATOR_ROLE, address, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n운영자 권한 제거\n주소: ${shortenAddress(address)}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 운영자 권한 제거 완료!\n\n주소: ${shortenAddress(address)}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    document.getElementById("revokeOperatorAddress").value = "";
    
  } catch (e) {
    errorLog("운영자 권한 제거 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 관리자 권한 부여 (주의: DEFAULT_ADMIN_ROLE)
 */
async function grantAdminRole() {
  await ensureConnected();
  
  if (isProcessing) {
    alert("트랜잭션 처리 중입니다...");
    return;
  }
  
  if (!confirm("⚠️ 경고: 관리자 권한은 모든 권한을 포함합니다.\n\n정말 부여하시겠습니까?")) {
    return;
  }
  
  const button = event.target;
  const originalText = button.innerText;
  
  isProcessing = true;
  button.disabled = true;
  button.innerText = "⏳ 처리 중...";
  
  try {
    await checkAndSwitchNetwork();
    
    const address = document.getElementById("adminAddress").value.trim();
    
    // 입력 검증
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // DEFAULT_ADMIN_ROLE 가져오기
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.grantRole(DEFAULT_ADMIN_ROLE, address);
    
    // 트랜잭션 전송
    const tx = await contract.grantRole(DEFAULT_ADMIN_ROLE, address, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n관리자 권한 부여\n주소: ${shortenAddress(address)}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 관리자 권한 부여 완료!\n\n주소: ${shortenAddress(address)}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    document.getElementById("adminAddress").value = "";
    
  } catch (e) {
    errorLog("관리자 권한 부여 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 관리자 권한 제거
 */
async function revokeAdminRole() {
  await ensureConnected();
  
  if (isProcessing) {
    alert("트랜잭션 처리 중입니다...");
    return;
  }
  
  if (!confirm("⚠️ 경고: 관리자 권한을 제거하면 해당 주소는 모든 관리 기능을 사용할 수 없습니다.\n\n정말 제거하시겠습니까?")) {
    return;
  }
  
  const button = event.target;
  const originalText = button.innerText;
  
  isProcessing = true;
  button.disabled = true;
  button.innerText = "⏳ 처리 중...";
  
  try {
    await checkAndSwitchNetwork();
    
    const address = document.getElementById("revokeAdminAddress").value.trim();
    
    // 입력 검증
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // DEFAULT_ADMIN_ROLE 가져오기
    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.revokeRole(DEFAULT_ADMIN_ROLE, address);
    
    // 트랜잭션 전송
    const tx = await contract.revokeRole(DEFAULT_ADMIN_ROLE, address, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n관리자 권한 제거\n주소: ${shortenAddress(address)}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 관리자 권한 제거 완료!\n\n주소: ${shortenAddress(address)}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    document.getElementById("revokeAdminAddress").value = "";
    
  } catch (e) {
    errorLog("관리자 권한 제거 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

// ============================================================
//                    조회 함수
// ============================================================

/**
 * 화이트리스트 여부 조회
 */
async function checkWhitelist() {
  try {
    const address = document.getElementById("checkWhitelistAddress").value.trim();
    
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    const isWhitelisted = await contract.methods.whitelist(address).call();
    
    const result = document.getElementById("whitelistResult");
    result.innerText = `주소: ${shortenAddress(address)}\n\n화이트리스트 상태: ${isWhitelisted ? "✅ 등록됨" : "❌ 미등록"}`;
    result.style.borderColor = isWhitelisted ? "#00ffcc" : "#ff6b6b";
    
  } catch (e) {
    errorLog("화이트리스트 조회 실패:", e);
    const result = document.getElementById("whitelistResult");
    result.innerText = "조회 실패: " + friendlyError(e);
    result.style.borderColor = "#ff6b6b";
  }
}

/**
 * NFT 보유량 조회
 */
async function checkNFTBalance() {
  try {
    const address = document.getElementById("checkNFTBalanceAddress").value.trim();
    
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    const balance = await contract.methods.balanceOf(address).call();
    
    const result = document.getElementById("nftBalanceResult");
    result.innerText = `주소: ${shortenAddress(address)}\n\nNFT 보유량: ${balance}개`;
    result.style.borderColor = "#00ffcc";
    
  } catch (e) {
    errorLog("NFT 보유량 조회 실패:", e);
    const result = document.getElementById("nftBalanceResult");
    result.innerText = "조회 실패: " + friendlyError(e);
    result.style.borderColor = "#ff6b6b";
  }
}

/**
 * 토큰 URI 조회
 */
async function checkTokenURI() {
  try {
    const tokenId = document.getElementById("checkTokenURIId").value.trim();
    
    if (!tokenId || tokenId === "0") {
      throw new Error("토큰 ID를 입력하세요. (1 이상)");
    }
    
    if (!isValidInteger(tokenId, 1)) {
      throw new Error("올바른 토큰 ID 형식이 아닙니다. (1 이상의 정수)");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    // tokenURI 조회
    const uri = await contract.methods.tokenURI(tokenId).call();
    
    const result = document.getElementById("tokenURIResult");
    result.innerHTML = `
<strong>토큰 ID:</strong> ${tokenId}
<strong>메타데이터 URI:</strong>
${uri}

<small style="color:#00ffcc;">💡 이 URL을 브라우저에서 열면 메타데이터를 확인할 수 있습니다.</small>
    `.trim();
    result.style.borderColor = "#00ffcc";
    
  } catch (e) {
    errorLog("토큰 URI 조회 실패:", e);
    const result = document.getElementById("tokenURIResult");
    
    // 에러 타입별 친화적 메시지
    let errorMsg = friendlyError(e);
    if (e.message && e.message.includes("nonexistent")) {
      errorMsg = "해당 토큰 ID는 아직 민팅되지 않았습니다.";
    } else if (e.message && e.message.includes("URI")) {
      errorMsg = "토큰 URI 조회 실패: Base URI가 설정되지 않았거나 토큰이 존재하지 않습니다.";
    }
    
    result.innerText = "조회 실패: " + errorMsg;
    result.style.borderColor = "#ff6b6b";
  }
}

/**
 * 권한 조회
 */
async function checkRole() {
  try {
    const address = document.getElementById("checkRoleAddress").value.trim();
    
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    const DEFAULT_ADMIN_ROLE = await contract.methods.DEFAULT_ADMIN_ROLE().call();
    const OPERATOR_ROLE = await contract.methods.OPERATOR_ROLE().call();
    
    const isAdmin = await contract.methods.hasRole(DEFAULT_ADMIN_ROLE, address).call();
    const isOperator = await contract.methods.hasRole(OPERATOR_ROLE, address).call();
    
    let roleText = "";
    if (isAdmin) {
      roleText = "👑 관리자 (Admin)";
    } else if (isOperator) {
      roleText = "⚙️ 운영자 (Operator)";
    } else {
      roleText = "👤 일반 사용자";
    }
    
    const result = document.getElementById("roleResult");
    result.innerText = `주소: ${shortenAddress(address)}\n\n권한: ${roleText}`;
    result.style.borderColor = "#00ffcc";
    
  } catch (e) {
    errorLog("권한 조회 실패:", e);
    const result = document.getElementById("roleResult");
    result.innerText = "조회 실패: " + friendlyError(e);
    result.style.borderColor = "#ff6b6b";
  }
}

/**
 * 화이트리스트 민팅 상태 조회
 */
async function checkWhitelistMintStatus() {
  try {
    const address = document.getElementById("checkWhitelistMintAddress").value.trim();
    
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    const status = await contract.methods.whitelistMintStatus(address).call();
    
    const result = document.getElementById("whitelistMintStatusResult");
    result.innerText = `주소: ${shortenAddress(address)}\n\n` +
      `민팅 가능: ${status.isOpen ? "✅ 가능" : "❌ 불가능"}\n` +
      `화이트리스트: ${status.isWhitelisted ? "✅ 등록" : "❌ 미등록"}\n` +
      `가격: ${formatEther(status.priceWei)} ETH\n` +
      `다음 토큰 ID: ${status.nextTokenId}\n` +
      `판매 종료 ID: ${status.endTokenId}\n` +
      `남은 수량: ${status.remaining}개\n` +
      `현재 Epoch: ${status.epoch}\n\n` +
      `[화이트리스트 민팅 현황]\n` +
      `이번 Epoch 민팅: ${status.userMintedWhitelist}개\n` +
      `남은 한도: ${status.userRemainingWhitelist}개`;
    result.style.borderColor = "#00ffcc";
    
  } catch (e) {
    errorLog("화이트리스트 민팅 상태 조회 실패:", e);
    const result = document.getElementById("whitelistMintStatusResult");
    result.innerText = "조회 실패: " + friendlyError(e);
    result.style.borderColor = "#ff6b6b";
  }
}

/**
 * 퍼블릭 민팅 상태 조회
 */
async function checkPublicMintStatus() {
  try {
    const address = document.getElementById("checkPublicMintAddress")?.value.trim();
    
    // 주소가 없으면 0x0 사용 (전체 상태만 조회)
    const queryAddress = (address && isValidEthereumAddress(address)) 
      ? address 
      : "0x0000000000000000000000000000000000000000";
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    const status = await contract.methods.publicMintStatus(queryAddress).call();
    
    const result = document.getElementById("publicMintStatusResult");
    
    let output = `퍼블릭 민팅 상태\n\n` +
      `민팅 가능: ${status.isOpen ? "✅ 가능" : "❌ 불가능"}\n` +
      `가격: ${formatEther(status.priceWei)} ETH\n` +
      `다음 토큰 ID: ${status.nextTokenId}\n` +
      `판매 종료 ID: ${status.endTokenId}\n` +
      `남은 수량: ${status.remaining}개\n` +
      `현재 Epoch: ${status.epoch}`;
    
    // 주소가 유효하면 개인 정보도 표시
    if (address && isValidEthereumAddress(address)) {
      output += `\n\n[${shortenAddress(address)} 정보]\n` +
        `이번 Epoch 민팅: ${status.userMintedPublic}개\n` +
        `남은 한도: ${status.userRemainingPublic}개`;
    }
    
    result.innerText = output;
    result.style.borderColor = "#00ffcc";
    
  } catch (e) {
    errorLog("퍼블릭 민팅 상태 조회 실패:", e);
    const result = document.getElementById("publicMintStatusResult");
    result.innerText = "조회 실패: " + friendlyError(e);
    result.style.borderColor = "#ff6b6b";
  }
}

/**
 * 사용자 민팅 현황 조회 (Epoch별)
 */
async function checkUserMintInfo() {
  try {
    const address = document.getElementById("checkUserMintInfoAddress").value.trim();
    
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    const info = await contract.methods.getUserMintInfo(address).call();
    
    const result = document.getElementById("userMintInfoResult");
    result.innerText = `주소: ${shortenAddress(address)}\n\n` +
      `현재 Epoch: ${info.epoch}\n\n` +
      `[이번 Epoch 민팅 현황]\n` +
      `화이트리스트 민팅: ${info.whitelistMintedThisEpoch}개\n` +
      `퍼블릭 민팅: ${info.publicMintedThisEpoch}개\n` +
      `총 민팅: ${info.totalMintedThisEpoch}개\n\n` +
      `[남은 한도]\n` +
      `화이트리스트 남은 한도: ${info.whitelistRemainingThisEpoch}개\n` +
      `퍼블릭 남은 한도: ${info.publicRemainingThisEpoch}개\n` +
      `최대 가능 민팅: ${info.maxPossibleMintThisEpoch}개`;
    result.style.borderColor = "#00ffcc";
    
  } catch (e) {
    errorLog("사용자 민팅 현황 조회 실패:", e);
    const result = document.getElementById("userMintInfoResult");
    result.innerText = "조회 실패: " + friendlyError(e);
    result.style.borderColor = "#ff6b6b";
  }
}

// ============================================================
//                    컨트랙트 상태 조회 및 대시보드
// ============================================================

/**
 * 컨트랙트 상태 로드
 */
async function loadContractState() {
  if (!WalletAddress || !ethersSigner) return;
  
  try {
    const CONTRACT_ADDRESS = getContractAddress(Network);

    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      debugLog("컨트랙트 주소가 설정되지 않음");
      resetDashboard("컨트랙트 미설정 (현재 네트워크에 배포 안됨)");
      return;
    }
    
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    const webContract = new web3.eth.Contract(NFT_ABI, CONTRACT_ADDRESS);
    
    // 병렬 조회
    const [
      name,
      symbol,
      totalSupply,
      totalMinted,
      maxSupply,
      maxMintAmount,
      maxWhitelistBatchSize,
      maxOperatorMintAmount,
      paused,
      whitelistStart,
      publicStart,
      whitelistCost,
      publicCost,
      saleEndTokenId,
      withdrawalAddress,
      contractBalance
    ] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.totalSupply(),
      contract.totalMinted().catch(() => contract.totalSupply()),
      contract.maxSupply(),
      contract.maxMintAmount(),
      contract.maxWhitelistBatchSize(),
      contract.maxOperatorMintAmount(),
      contract.paused(),
      contract.whitelistStart(),
      contract.publicStart(),
      contract.whitelistCost(),
      contract.publicCost(),
      contract.saleEndTokenId(),
      contract.withdrawalAddress(), // public 변수 직접 호출
      ethersProvider.getBalance(CONTRACT_ADDRESS)
    ]);
    
    // 대시보드 업데이트
    setText("ds_name", name);
    setText("ds_symbol", symbol);
    setText("ds_totalSupply", totalSupply.toString());
    setText("ds_totalMinted", totalMinted.toString());
    setText("ds_maxSupply", maxSupply.toString());
    setText("ds_maxMintAmount", maxMintAmount.toString());
    setText("ds_maxWhitelistBatchSize", maxWhitelistBatchSize.toString());
    setText("ds_maxOperatorMintAmount", maxOperatorMintAmount.toString());
    setText("ds_paused", paused ? "⏸️ 일시정지" : "▶️ 정상");
    setText("ds_whitelistStart", whitelistStart ? "✅ 시작됨" : "❌ 중지됨");
    setText("ds_publicStart", publicStart ? "✅ 시작됨" : "❌ 중지됨");
    setText("ds_whitelistCost", `${formatEther(whitelistCost)} ETH`);
    setText("ds_publicCost", `${formatEther(publicCost)} ETH`);
    setText("ds_saleEndTokenId", saleEndTokenId.toString());
    setText("ds_withdrawalAddress", shortenAddress(withdrawalAddress));
    setText("ds_contractBalance", `${parseFloat(formatEther(contractBalance)).toFixed(4)} ETH`);
    
    // 체크박스 상태 업데이트
    const pauseCheckbox = document.getElementById("pauseCheckbox");
    if (pauseCheckbox) pauseCheckbox.checked = paused;
    
    const whitelistStartCheckbox = document.getElementById("quickWhitelistStart");
    if (whitelistStartCheckbox) whitelistStartCheckbox.checked = whitelistStart;
    
    const publicStartCheckbox = document.getElementById("quickPublicStart");
    if (publicStartCheckbox) publicStartCheckbox.checked = publicStart;
    
    debugLog("컨트랙트 상태 로드 완료");
    
  } catch (e) {
    errorLog("컨트랙트 상태 로드 실패:", e);
  }
}