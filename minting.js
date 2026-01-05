/*
 * NFT 관리 대시보드 - 민팅 함수
 * Owner 민팅, 화이트리스트 일괄 관리
 */

// ============================================================
//                    Owner 민팅
// ============================================================

/**
 * Owner가 특정 주소로 NFT 민팅
 */
async function ownerMint() {
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
    
    const to = document.getElementById("mintTo").value.trim();
    const amount = document.getElementById("mintAmount").value.trim();
    
    // 입력 검증
    if (!isValidEthereumAddress(to)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    if (!isValidInteger(amount, 1, 100)) {
      throw new Error("민팅 수량은 1~100 사이의 정수여야 합니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.safeMint(to, amount);
    
    // 트랜잭션 전송
    const tx = await contract.safeMint(to, amount, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n트랜잭션 해시: ${tx.hash}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 민팅 완료!\n\n수량: ${amount}개\n받는 주소: ${shortenAddress(to)}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    // 정보 갱신
    await updateWalletInfo();
    await loadContractState();
    
    // 입력 필드 초기화
    document.getElementById("mintTo").value = "";
    document.getElementById("mintAmount").value = "";
    
  } catch (e) {
    errorLog("Owner 민팅 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

// ============================================================
//                    화이트리스트 일괄 관리
// ============================================================

/**
 * 화이트리스트 일괄 추가
 */
async function addWhitelistBatch() {
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
    
    // 동적 입력 방식으로 주소 수집
    const rawAddresses = collectWhitelistAddresses('add');
    
    if (rawAddresses.length === 0) {
      throw new Error("주소 목록이 비어있습니다.");
    }
    
    // 주소 검증
    const addresses = [];
    const errors = [];
    
    for (let i = 0; i < rawAddresses.length; i++) {
      const addr = rawAddresses[i];
      if (isValidEthereumAddress(addr)) {
        addresses.push(addr);
      } else {
        errors.push(`${i + 1}번: 잘못된 주소 형식 (${addr})`);
      }
    }
    
    if (errors.length > 0) {
      alert("❌ 주소 형식 오류:\n\n" + errors.join('\n'));
      return;
    }
    
    if (addresses.length === 0) {
      throw new Error("유효한 주소가 없습니다.");
    }
    
    if (addresses.length > 100) {
      throw new Error("한 번에 최대 100개까지만 추가할 수 있습니다.");
    }
    
    // 중복 제거 (대소문자 무시)
    const uniqueAddresses = uniqueArray(addresses);
    
    if (uniqueAddresses.length !== addresses.length) {
      alert(`⚠️ 중복된 주소가 ${addresses.length - uniqueAddresses.length}개 발견되어 제거되었습니다.`);
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.addWhitelist(uniqueAddresses);
    
    // 트랜잭션 전송
    const tx = await contract.addWhitelist(uniqueAddresses, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n추가 주소: ${uniqueAddresses.length}개\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 화이트리스트 추가 완료!\n\n추가된 주소: ${uniqueAddresses.length}개\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    // 입력 필드 초기화
    const countInput = document.getElementById("whitelistAddCount");
    if (countInput) countInput.value = "";
    const inputsContainer = document.getElementById("whitelistAddInputs");
    if (inputsContainer) inputsContainer.innerHTML = "";
    const previewEl = document.getElementById("whitelistPreview");
    if (previewEl) previewEl.innerText = "";
    
  } catch (e) {
    errorLog("화이트리스트 추가 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 화이트리스트 일괄 제거
 */
async function removeWhitelistBatch() {
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
    
    // 동적 입력 방식으로 주소 수집
    const rawAddresses = collectWhitelistAddresses('remove');
    
    if (rawAddresses.length === 0) {
      throw new Error("주소 목록이 비어있습니다.");
    }
    
    // 주소 검증
    const addresses = [];
    const errors = [];
    
    for (let i = 0; i < rawAddresses.length; i++) {
      const addr = rawAddresses[i];
      if (isValidEthereumAddress(addr)) {
        addresses.push(addr);
      } else {
        errors.push(`${i + 1}번: 잘못된 주소 형식 (${addr})`);
      }
    }
    
    if (errors.length > 0) {
      alert("❌ 주소 형식 오류:\n\n" + errors.join('\n'));
      return;
    }
    
    if (addresses.length === 0) {
      throw new Error("유효한 주소가 없습니다.");
    }
    
    if (addresses.length > 100) {
      throw new Error("한 번에 최대 100개까지만 제거할 수 있습니다.");
    }
    
    // 중복 제거 (대소문자 무시)
    const uniqueAddresses = uniqueArray(addresses);
    
    if (uniqueAddresses.length !== addresses.length) {
      alert(`⚠️ 중복된 주소가 ${addresses.length - uniqueAddresses.length}개 발견되어 제거되었습니다.`);
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.removeWhitelist(uniqueAddresses);
    
    // 트랜잭션 전송
    const tx = await contract.removeWhitelist(uniqueAddresses, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    alert(`⏳ 트랜잭션 전송됨\n\n제거 주소: ${uniqueAddresses.length}개\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 화이트리스트 제거 완료!\n\n제거된 주소: ${uniqueAddresses.length}개\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    // 입력 필드 초기화
    const countInput = document.getElementById("whitelistRemoveCount");
    if (countInput) countInput.value = "";
    const inputsContainer = document.getElementById("whitelistRemoveInputs");
    if (inputsContainer) inputsContainer.innerHTML = "";
    const previewEl = document.getElementById("whitelistRemovePreview");
    if (previewEl) previewEl.innerText = "";
    
  } catch (e) {
    errorLog("화이트리스트 제거 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

/**
 * 화이트리스트 미리보기
 */
function previewWhitelist() {
  const textarea = document.getElementById("whitelistAddresses");
  const preview = document.getElementById("whitelistPreview");
  const input = textarea.value.trim();
  
  if (!input) {
    preview.innerText = "";
    return;
  }
  
  // 줄 단위로 분리하고 정리
  const lines = input.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // 주소 검증
  const validAddresses = [];
  const invalidAddresses = [];
  
  lines.forEach((addr, index) => {
    if (isValidEthereumAddress(addr)) {
      validAddresses.push(addr);
    } else {
      invalidAddresses.push(`줄 ${index + 1}: ${addr}`);
    }
  });
  
  // 중복 제거
  const uniqueAddresses = uniqueArray(validAddresses);
  const duplicates = validAddresses.length - uniqueAddresses.length;
  
  let previewText = `✅ 유효한 주소: ${uniqueAddresses.length}개\n`;
  
  if (duplicates > 0) {
    previewText += `⚠️ 중복 주소: ${duplicates}개 (제거됨)\n`;
  }
  
  if (invalidAddresses.length > 0) {
    previewText += `\n❌ 잘못된 형식 (${invalidAddresses.length}개):\n`;
    previewText += invalidAddresses.slice(0, 5).join('\n');
    if (invalidAddresses.length > 5) {
      previewText += `\n... 외 ${invalidAddresses.length - 5}개`;
    }
  }
  
  if (uniqueAddresses.length > 100) {
    previewText += `\n\n⚠️ 한 번에 최대 100개까지만 추가할 수 있습니다. (현재: ${uniqueAddresses.length}개)`;
  }
  
  preview.innerText = previewText;
  preview.style.borderColor = invalidAddresses.length > 0 ? "#ff6b6b" : "#00ffcc";
}

/**
 * 화이트리스트 제거 미리보기
 */
function previewWhitelistRemove() {
  const textarea = document.getElementById("whitelistRemoveAddresses");
  const preview = document.getElementById("whitelistRemovePreview");
  const input = textarea.value.trim();
  
  if (!input) {
    preview.innerText = "";
    return;
  }
  
  // 줄 단위로 분리하고 정리
  const lines = input.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  // 주소 검증
  const validAddresses = [];
  const invalidAddresses = [];
  
  lines.forEach((addr, index) => {
    if (isValidEthereumAddress(addr)) {
      validAddresses.push(addr);
    } else {
      invalidAddresses.push(`줄 ${index + 1}: ${addr}`);
    }
  });
  
  // 중복 제거
  const uniqueAddresses = uniqueArray(validAddresses);
  const duplicates = validAddresses.length - uniqueAddresses.length;
  
  let previewText = `✅ 유효한 주소: ${uniqueAddresses.length}개\n`;
  
  if (duplicates > 0) {
    previewText += `⚠️ 중복 주소: ${duplicates}개 (제거됨)\n`;
  }
  
  if (invalidAddresses.length > 0) {
    previewText += `\n❌ 잘못된 형식 (${invalidAddresses.length}개):\n`;
    previewText += invalidAddresses.slice(0, 5).join('\n');
    if (invalidAddresses.length > 5) {
      previewText += `\n... 외 ${invalidAddresses.length - 5}개`;
    }
  }
  
  if (uniqueAddresses.length > 100) {
    previewText += `\n\n⚠️ 한 번에 최대 100개까지만 제거할 수 있습니다. (현재: ${uniqueAddresses.length}개)`;
  }
  
  preview.innerText = previewText;
  preview.style.borderColor = invalidAddresses.length > 0 ? "#ff6b6b" : "#00ffcc";
}

/**
 * 개별 화이트리스트 설정
 */
async function setWhitelistSingle() {
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
    
    const address = document.getElementById("whitelistSingleAddress").value.trim();
    const statusSelect = document.getElementById("whitelistSingleStatus");
    const status = statusSelect.value === "true";
    
    // 입력 검증
    if (!isValidEthereumAddress(address)) {
      throw new Error("올바른 주소 형식이 아닙니다.");
    }
    
    const CONTRACT_ADDRESS = getContractAddress(Network);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, NFT_ABI, ethersSigner);
    
    // 가스 추정 (20% 여유)
    const gas = await contract.estimateGas.setWhitelist(address, status);
    
    // 트랜잭션 전송
    const tx = await contract.setWhitelist(address, status, {
      gasLimit: gas.mul(120).div(100)
    });
    
    const explorerUrl = getExplorerUrl(Network);
    const action = status ? "추가" : "제거";
    alert(`⏳ 트랜잭션 전송됨\n\n화이트리스트 ${action}\n주소: ${shortenAddress(address)}\n\n${explorerUrl}/tx/${tx.hash}`);
    
    // 트랜잭션 대기
    try {
      await tx.wait();
      alert(`✅ 화이트리스트 ${action} 완료!\n\n주소: ${shortenAddress(address)}\n\n트랜잭션 해시: ${tx.hash}`);
    } catch (waitError) {
      alert(`⚠️ 트랜잭션 전송은 완료되었으나 확인 중 오류 발생\n\nExplorer에서 확인: ${explorerUrl}/tx/${tx.hash}`);
    }
    
    // 입력 필드 초기화
    document.getElementById("whitelistSingleAddress").value = "";
    
  } catch (e) {
    errorLog("화이트리스트 설정 실패:", e);
    alert(friendlyError(e));
  } finally {
    isProcessing = false;
    button.disabled = false;
    button.innerText = originalText;
  }
}

function clampInt(v, min, max) {
  const n = parseInt(String(v ?? "").trim(), 10);
  if (Number.isNaN(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function renderWhitelistInputs(mode, force = false) {
  const isAdd = mode === "add";
  const countEl = document.getElementById(isAdd ? "whitelistAddCount" : "whitelistRemoveCount");
  const wrap = document.getElementById(isAdd ? "whitelistAddInputs" : "whitelistRemoveInputs");
  const previewEl = document.getElementById(isAdd ? "whitelistPreview" : "whitelistRemovePreview");

  if (!countEl || !wrap) return;

  const n = clampInt(countEl.value, 1, 100);
  if (!n) {
    wrap.innerHTML = "";
    if (previewEl) previewEl.innerText = "";
    return;
  }

  // force가 아니면 이미 같은 개수면 유지 (입력 중 값 날아가는 것 방지)
  const existing = wrap.querySelectorAll("input[data-wl='1']").length;
  if (!force && existing === n) return;

  const oldValues = [...wrap.querySelectorAll("input[data-wl='1']")].map(i => i.value);

  wrap.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-input";
    input.placeholder = `주소 ${i + 1} (0x...)`;
    input.setAttribute("data-wl", "1");
    input.value = oldValues[i] || "";
    input.addEventListener("input", () => previewWhitelistDynamic(mode));
    wrap.appendChild(input);
  }

  previewWhitelistDynamic(mode);
}

function collectWhitelistAddresses(mode) {
  const isAdd = mode === "add";
  const wrap = document.getElementById(isAdd ? "whitelistAddInputs" : "whitelistRemoveInputs");
  if (!wrap) return [];

  return [...wrap.querySelectorAll("input[data-wl='1']")]
    .map(i => i.value.trim())
    .filter(Boolean);
}

function previewWhitelistDynamic(mode) {
  const isAdd = mode === "add";
  const previewEl = document.getElementById(isAdd ? "whitelistPreview" : "whitelistRemovePreview");
  if (!previewEl) return;

  const raw = collectWhitelistAddresses(mode);
  if (raw.length === 0) {
    previewEl.innerText = "";
    return;
  }

  const invalid = [];
  const valid = [];

  raw.forEach((a, idx) => {
    if (!isValidEthereumAddress(a)) invalid.push(`${idx + 1}번: ${a}`);
    else valid.push(a);
  });

  const unique = [...new Set(valid.map(a => a.toLowerCase()))].length;

  previewEl.innerText =
    `입력: ${raw.length}개\n` +
    `유효: ${valid.length}개 (유니크: ${unique}개)\n` +
    (invalid.length ? `\n❌ 잘못된 주소:\n- ${invalid.slice(0, 10).join("\n- ")}${invalid.length > 10 ? "\n- ..." : ""}` : "");
}
