/*
 * NFT 관리 대시보드 - 컨트랙트 설정 함수
 * 판매 설정, 제한 설정, 기본 설정, 권한 관리
 */

// ============================================================
//                    판매 설정
// ============================================================

/**
 * 🔄 새 라운드(Epoch) 시작 - 간편 버전
 * ⚠️ 주의: 이 함수는 되돌릴 수 없습니다!
 * - currentEpoch만 증가 (예: 1월→2월)
 * - 모든 사용자의 월별 민팅 한도 자동 초기화
 * - 판매 설정은 "종합 판매 설정"에서 별도로 진행
 */
async function startNewRound() {
  await ensureConnected();

  if (isProcessing) {
    alert("트랜잭션 처리 중입니다.");
    return;
  }

  const button = event.target;
  const originalText = button.innerText;

  isProcessing = true;
  button.disabled = true;
  button.innerText = "⏳ 처리 중...";

  try {
    await checkAndSwitchNetwork();

    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);

    // 현재 epoch 조회
    const currentEpoch = await contract.currentEpoch();
    const nextEpoch = currentEpoch.add(1);

    // 확인 다이얼로그
    const confirmMessage = 
      `⚠️ 새 라운드를 시작하시겠습니까?\n\n` +
      `현재 라운드: ${currentEpoch.toString()}\n` +
      `다음 라운드: ${nextEpoch.toString()}\n\n` +
      `🔥 주의사항:\n` +
      `1. 이 작업은 되돌릴 수 없습니다!\n` +
      `2. 모든 사용자의 민팅 한도가 초기화됩니다.\n` +
      `3. 트랜잭션 후 "현재 라운드 조회"로 확인하세요!\n\n` +
      `💡 판매 설정(가격, 종료 ID)은 "종합 판매 설정"에서 별도로 진행하세요.`;

    if (!confirm(confirmMessage)) {
      throw new Error("사용자가 취소했습니다.");
    }

    // 가스 추정 (30% 여유)
    const gas = await contract.estimateGas.startNewRound();

    // 트랜잭션 전송
    const tx = await contract.startNewRound({
      gasLimit: gas.mul(130).div(100)
    });

    alert(
      `🚀 라운드 시작 트랜잭션이 전송되었습니다!\n\n` +
      `Tx Hash: ${tx.hash}\n\n` +
      `⏳ 블록 확인 중... (30초~1분 소요)\n\n` +
      `⚠️ 취소 알람이 떠도 성공했을 수 있으니\n` +
      `   "현재 라운드 조회"로 꼭 확인하세요!`
    );

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      alert(
        `✅ 새 라운드 시작 성공!\n\n` +
        `라운드: ${currentEpoch.toString()} → ${nextEpoch.toString()}\n` +
        `모든 사용자의 민팅 한도가 초기화되었습니다.\n\n` +
        `📌 다음 단계:\n` +
        `1. "현재 라운드 조회"로 라운드 번호 확인\n` +
        `2. "종합 판매 설정"에서 가격/종료 ID 설정\n\n` +
        `Tx Hash: ${receipt.transactionHash}`
      );
      
      // 대시보드 새로고침
      await loadDashboardInfo();
    } else {
      throw new Error("트랜잭션이 실패했습니다.");
    }

  } catch (error) {
    console.error("startNewRound 에러:", error);
    handleError(error, "새 라운드 시작");
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}


/**
 * 🔍 현재 라운드(Epoch) 조회
 * 가스비 무료 조회 함수
 */
async function getCurrentEpoch() {
  await ensureConnected();

  try {
    await checkAndSwitchNetwork();

    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersProvider);

    const currentEpoch = await contract.currentEpoch();

    const resultDiv = document.getElementById("currentEpochResult");
    
    let monthName = "";
    const epochNum = currentEpoch.toNumber();
    
    if (epochNum === 0) {
      monthName = "⚠️ 아직 라운드가 시작되지 않았습니다";
    } else if (epochNum >= 1 && epochNum <= 12) {
      monthName = `${epochNum}월`;
    } else {
      monthName = `라운드 ${epochNum}`;
    }

    resultDiv.innerHTML = `
<strong>현재 라운드:</strong> ${currentEpoch.toString()}<br>
<strong>의미:</strong> ${monthName}<br>
<br>
<small style="color:#b8b8b8;">
💡 라운드 번호는 월을 의미합니다.<br>
   1 = 1월, 2 = 2월, 3 = 3월 ...<br>
<br>
⚠️ 라운드 0 = 세일 미시작<br>
   새 라운드 시작 버튼을 눌러주세요.
</small>
    `.trim();

  } catch (error) {
    console.error("getCurrentEpoch 에러:", error);
    const resultDiv = document.getElementById("currentEpochResult");
    resultDiv.innerText = `조회 실패: ${error.message}`;
  }
}

/**
 * 종합 판매 설정
 */
/**
 * 종합 판매 설정
 * - (추가) saleEndTokenId 입력값 검증:
 *   1) maxSupply 초과면 거부
 *   2) 현재 minted 개수보다 작으면 거부
 */
async function setSaleConfig() {
  await ensureConnected();

  if (isProcessing) {
    alert("트랜잭션 처리 중입니다.");
    return;
  }

  const button = event.target;
  const originalText = button.innerText;

  isProcessing = true;
  button.disabled = true;
  button.innerText = "⏳ 처리 중.";

  try {
    await checkAndSwitchNetwork();

    const whitelistCost = document.getElementById("saleWhitelistCost").value.trim();
    const publicCost = document.getElementById("salePublicCost").value.trim();
    const endTokenId = document.getElementById("saleEndTokenId").value.trim();
    const whitelistStart = document.getElementById("saleWhitelistStart").checked;
    const publicStart = document.getElementById("salePublicStart").checked;

    // 입력 검증
    if (!isValidAmount(whitelistCost, 0)) {
      throw new Error("화이트리스트 가격 형식이 올바르지 않습니다.");
    }
    if (!isValidAmount(publicCost, 0)) {
      throw new Error("퍼블릭 가격 형식이 올바르지 않습니다.");
    }
    if (!isValidInteger(endTokenId, 1)) {
      throw new Error("판매 종료 ID는 1 이상인 정수여야 합니다.");
    }

    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);

    // ✅ 추가: endTokenId 범위 검증 (maxSupply / minted 기준)
    const [maxSupplyBN, totalMintedBN] = await Promise.all([
      contract.maxSupply(),
      contract.totalMinted()
    ]);

    const endBN = ethers.BigNumber.from(endTokenId);

    // 1) maxSupply 초과 거부
    if (endBN.gt(maxSupplyBN)) {
      throw new Error(
        `판매 종료 ID가 maxSupply를 초과했습니다.\n\n` +
        `- 입력값: ${endBN.toString()}\n` +
        `- maxSupply: ${maxSupplyBN.toString()}`
      );
    }

    // 2) 민팅된 개수보다 작으면 거부
    // (주의: totalMinted=10이면 이미 1~10 발행된 상태 → endTokenId는 최소 10 이상)
    if (endBN.lt(totalMintedBN)) {
      throw new Error(
        `판매 종료 ID가 현재 민팅된 개수보다 작습니다.\n\n` +
        `- 입력값: ${endBN.toString()}\n` +
        `- 현재 민팅됨(totalMinted): ${totalMintedBN.toString()}`
      );
    }

    const whitelistCostWei = parseEther(whitelistCost);
    const publicCostWei = parseEther(publicCost);

    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setSaleConfig(
      whitelistCostWei,
      publicCostWei,
      endTokenId,
      whitelistStart,
      publicStart
    );

    // 트랜잭션 전송
    const tx = await contract.setSaleConfig(
      whitelistCostWei,
      publicCostWei,
      endTokenId,
      whitelistStart,
      publicStart,
      {
        gasLimit: gas.mul(120).div(100)
      }
    );

    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n판매 설정 업데이트\n\n${explorerUrl}/tx/${tx.hash}`);

    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(
        `✅ 판매 설정 업데이트 완료!\n\n` +
        `화이트리스트: ${whitelistStart ? "시작" : "중지"}\n` +
        `퍼블릭: ${publicStart ? "시작" : "중지"}\n` +
        `화이트리스트 가격: ${whitelistCost} ETH\n` +
        `퍼블릭 가격: ${publicCost} ETH\n` +
        `판매 종료 ID: ${endTokenId}\n\n` +
        `트랜잭션 해시: ${tx.hash}`
      );
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }

    await loadContractState();

  } catch (e) {
    errorLog("판매 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 화이트리스트 판매 시작/중지
 */
async function toggleWhitelistSale() {
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
    
    const checkbox = document.getElementById("quickWhitelistStart");
    const state = checkbox.checked;
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setWhitelistStart(state);
    
    // 트랜잭션 전송
    const tx = await contract.setWhitelistStart(state, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    const action = state ? "시작" : "중지";
    alert(`⏳ 트랜잭션 전송됨\n\n화이트리스트 판매 ${action}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 화이트리스트 판매 ${action} 완료!\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    
  } catch (e) {
    errorLog("화이트리스트 판매 토글 실패:", e);
    alert(friendlyError(e));
    
    // 체크박스 원상복구
    const checkbox = document.getElementById("quickWhitelistStart");
    checkbox.checked = !checkbox.checked;
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 퍼블릭 판매 시작/중지
 */
async function togglePublicSale() {
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
    
    const checkbox = document.getElementById("quickPublicStart");
    const state = checkbox.checked;
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setPublicStart(state);
    
    // 트랜잭션 전송
    const tx = await contract.setPublicStart(state, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    const action = state ? "시작" : "중지";
    alert(`⏳ 트랜잭션 전송됨\n\n퍼블릭 판매 ${action}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 퍼블릭 판매 ${action} 완료!\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    
  } catch (e) {
    errorLog("퍼블릭 판매 토글 실패:", e);
    alert(friendlyError(e));
    
    // 체크박스 원상복구
    const checkbox = document.getElementById("quickPublicStart");
    checkbox.checked = !checkbox.checked;
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

// ============================================================
//                    제한 설정
// ============================================================

/**
 * 최대 발행량 설정
 */
async function setMaxSupply() {
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
    
    const maxSupply = document.getElementById("newMaxSupply").value.trim();
    
    // 입력 검증
    if (!isValidInteger(maxSupply, 1)) {
      throw new Error("최대 발행량은 1 이상의 정수여야 합니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setMaxSupply(maxSupply);
    
    // 트랜잭션 전송
    const tx = await contract.setMaxSupply(maxSupply, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n새 최대 발행량: ${formatNumber(maxSupply)}개\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 최대 발행량 업데이트 완료!\n\n새 최대 발행량: ${formatNumber(maxSupply)}개\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    document.getElementById("newMaxSupply").value = "";
    
  } catch (e) {
    errorLog("최대 발행량 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 화이트리스트 트랜잭션당 민팅 제한 설정
 */
async function setMaxWhitelistMintPerTx() {
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
    
    const newLimit = document.getElementById("newMaxWhitelistMintPerTx").value.trim();
    
    // 입력 검증
    if (!isValidInteger(newLimit, 1, 2)) {
      throw new Error("화이트리스트 1회 민팅 제한은 1~2 사이의 정수여야 합니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setMaxWhitelistMintPerTx(newLimit);
    
    // 트랜잭션 전송
    const tx = await contract.setMaxWhitelistMintPerTx(newLimit, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n새 화이트리스트 1회 제한: ${newLimit}개\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 화이트리스트 1회 제한 설정 완료!\n\n새 제한: ${newLimit}개\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    document.getElementById("newMaxWhitelistMintPerTx").value = "";
    
  } catch (e) {
    errorLog("화이트리스트 1회 제한 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 퍼블릭 트랜잭션당 민팅 제한 설정
 */
async function setMaxPublicMintPerTx() {
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
    
    const newLimit = document.getElementById("newMaxPublicMintPerTx").value.trim();
    
    // 입력 검증
    if (!isValidInteger(newLimit, 1, 12)) {
      throw new Error("퍼블릭 1회 민팅 제한은 1~12 사이의 정수여야 합니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setMaxPublicMintPerTx(newLimit);
    
    // 트랜잭션 전송
    const tx = await contract.setMaxPublicMintPerTx(newLimit, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n새 퍼블릭 1회 제한: ${newLimit}개\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 퍼블릭 1회 제한 설정 완료!\n\n새 제한: ${newLimit}개\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    document.getElementById("newMaxPublicMintPerTx").value = "";
    
  } catch (e) {
    errorLog("퍼블릭 1회 제한 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}


/**
 * 화이트리스트 배치 크기 설정
 */
async function setMaxWhitelistBatchSize() {
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
    
    const maxSize = document.getElementById("newMaxWhitelistBatchSize").value.trim();
    
    // 입력 검증
    if (!isValidInteger(maxSize, 1, 300)) {
      throw new Error("배치 크기는 1~300 사이의 정수여야 합니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setMaxWhitelistBatchSize(maxSize);
    
    // 트랜잭션 전송
    const tx = await contract.setMaxWhitelistBatchSize(maxSize, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n새 배치 크기: ${maxSize}개\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 화이트리스트 배치 크기 업데이트 완료!\n\n새 배치 크기: ${maxSize}개\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    document.getElementById("newMaxWhitelistBatchSize").value = "";
    
  } catch (e) {
    errorLog("화이트리스트 배치 크기 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 운영자 최대 민팅 수량 설정
 */
async function setMaxOperatorMintAmount() {
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
    
    const maxAmount = document.getElementById("newMaxOperatorMintAmount").value.trim();
    
    // 입력 검증
    if (!isValidInteger(maxAmount, 1)) {
      throw new Error("최대 민팅 수량은 1 이상의 정수여야 합니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setMaxOperatorMintAmount(maxAmount);
    
    // 트랜잭션 전송
    const tx = await contract.setMaxOperatorMintAmount(maxAmount, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n새 운영자 최대 민팅 수량: ${maxAmount}개\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 운영자 최대 민팅 수량 업데이트 완료!\n\n새 수량: ${maxAmount}개\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    document.getElementById("newMaxOperatorMintAmount").value = "";
    
  } catch (e) {
    errorLog("운영자 최대 민팅 수량 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

// ============================================================
//                    기본 설정
// ============================================================

/**
 * Base URI 설정
 */
async function setBaseURI() {
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
    
    const baseURI = document.getElementById("newBaseURI").value.trim();
    
    // 입력 검증
    if (!baseURI) {
      throw new Error("Base URI를 입력해주세요.");
    }
    
    if (!isValidURI(baseURI)) {
      throw new Error("올바른 URI 형식이 아닙니다. (https://, ipfs://, ar:// 등)");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setBaseURI(baseURI);
    
    // 트랜잭션 전송
    const tx = await contract.setBaseURI(baseURI, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n새 Base URI 설정\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ Base URI 업데이트 완료!\n\n새 Base URI: ${baseURI}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    document.getElementById("newBaseURI").value = "";
    
  } catch (e) {
    errorLog("Base URI 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 일시정지 토글
 */
async function togglePause() {
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
    
    const checkbox = document.getElementById("pauseCheckbox");
    const state = checkbox.checked;
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.pause(state);
    
    // 트랜잭션 전송
    const tx = await contract.pause(state, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    const action = state ? "일시정지" : "재개";
    alert(`⏳ 트랜잭션 전송됨\n\n컨트랙트 ${action}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 컨트랙트 ${action} 완료!\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    
  } catch (e) {
    errorLog("일시정지 토글 실패:", e);
    alert(friendlyError(e));
    
    // 체크박스 원상복구
    const checkbox = document.getElementById("pauseCheckbox");
    checkbox.checked = !checkbox.checked;
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 로열티 설정
 */
async function setRoyalty() {
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
    
    const receiver = document.getElementById("royaltyReceiver").value.trim();
    const percentage = document.getElementById("royaltyPercentage").value.trim();
    
    // 입력 검증
    if (!isValidEthereumAddress(receiver)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    if (!isValidAmount(percentage, 0, 10)) {
      throw new Error("로열티 비율은 0~10% 사이여야 합니다.");
    }
    
    // 백분율을 basis points로 변환 (1% = 100 basis points)
    const numerator = Math.floor(parseFloat(percentage) * 100);
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setDefaultRoyalty(receiver, numerator);
    
    // 트랜잭션 전송
    const tx = await contract.setDefaultRoyalty(receiver, numerator, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n로열티 수신자: ${shortenAddress(receiver)}\n비율: ${percentage}%\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 로열티 설정 완료!\n\n수신자: ${shortenAddress(receiver)}\n비율: ${percentage}%\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    document.getElementById("royaltyReceiver").value = "";
    document.getElementById("royaltyPercentage").value = "";
    
  } catch (e) {
    errorLog("로열티 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 출금 주소 설정
 */
async function setWithdrawalAddress() {
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
    
    const address = document.getElementById("newWithdrawalAddress").value.trim();
    
    // 입력 검증
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setWithdrawalAddress(address);
    
    // 트랜잭션 전송
    const tx = await contract.setWithdrawalAddress(address, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n새 출금 주소: ${shortenAddress(address)}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 출금 주소 업데이트 완료!\n\n새 주소: ${shortenAddress(address)}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await loadContractState();
    document.getElementById("newWithdrawalAddress").value = "";
    
  } catch (e) {
    errorLog("출금 주소 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 컨트랙트 잔액 출금
 */
async function withdrawFunds() {
  await ensureConnected();
  
  if (isProcessing) {
    alert("트랜잭션 처리 중입니다...");
    return;
  }
  
  if (!confirm("⚠️ 컨트랙트의 모든 ETH를 출금합니다.\n\n계속하시겠습니까?")) {
    return;
  }
  
  const button = event.target;
  const originalText = button.innerText;
  
  isProcessing = true;
  button.disabled = true;
  button.innerText = "⏳ 처리 중...";
  
  try {
    await checkAndSwitchNetwork();
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.withdraw();
    
    // 트랜잭션 전송
    const tx = await contract.withdraw({
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\nETH 출금 중...\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 출금 완료!\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    await updateWalletInfo();
    await loadContractState();
    
  } catch (e) {
    errorLog("출금 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}
