/**
 * SMART VENDING MACHINE CONTROLLER - DIGITAL SYSTEM DESIGN
 * js/simulator-ui.js: Simulator UI, 7-Segment Decoder, Chute Physics & Audio-Visuals
 */

class SimulatorUI {
  constructor(fsm, waveform, diagram) {
    this.fsm = fsm;
    this.waveform = waveform;
    this.diagram = diagram;

    // Clock Generator state
    this.autoClockTimer = null;
    this.clockFrequencyHz = 1.0; // 0.5Hz, 1.0Hz, 2.0Hz
    this.isAutoClock = true;
    this.soundEnabled = true;

    // Track uncollected items and change for strict refund integrity
    this.uncollectedItem = null;
    this.itemCollected = false;
    this.latestBill = null;

    // Web Audio Synthesizer
    this.audioCtx = null;

    // Segment Bitmasks for digits 0-9 (a, b, c, d, e, f, g)
    this.segmentMap = {
      0: [1, 1, 1, 1, 1, 1, 0],
      1: [0, 1, 1, 0, 0, 0, 0],
      2: [1, 1, 0, 1, 1, 0, 1],
      3: [1, 1, 1, 1, 0, 0, 1],
      4: [0, 1, 1, 0, 0, 1, 1],
      5: [1, 0, 1, 1, 0, 1, 1],
      6: [1, 0, 1, 1, 1, 1, 1],
      7: [1, 1, 1, 0, 0, 0, 0],
      8: [1, 1, 1, 1, 1, 1, 1],
      9: [1, 1, 1, 1, 0, 1, 1],
      '-': [0, 0, 0, 0, 0, 0, 1],
      ' ': [0, 0, 0, 0, 0, 0, 0]
    };

    this.initDOMElements();
    this.bindEvents();
    this.startAutoClock();

    // Subscribe to FSM telemetry
    this.fsm.subscribe((telemetry) => this.onTelemetryUpdate(telemetry));
  }

  initDOMElements() {
    // Buttons
    this.btnStepClk = document.getElementById('btnStepClock');
    this.btnAutoClk = document.getElementById('btnAutoClock');
    this.btnReset = document.getElementById('btnMasterReset');
    this.btnCancelRefund = document.getElementById('btnCancelRefund');
    this.freqSelector = document.getElementById('clkFreqSelect');

    // Display elements
    this.clkLed = document.getElementById('clkLed');
    this.clkCycleVal = document.getElementById('clkCycleVal');
    this.currentStatePill = document.getElementById('currentStatePill');
    this.nextStatePill = document.getElementById('nextStatePill');
    this.hexBalanceDisplay = document.getElementById('hexBalanceVal');
    this.decBalanceDisplay = document.getElementById('decBalanceVal');

    // Chutes
    this.dispensedTray = document.getElementById('dispensedTray');
    this.changeCoinsTray = document.getElementById('changeCoinsTray');

    // Control flags LEDs
    this.ledDispense = document.getElementById('ledDispense');
    this.ledChange = document.getElementById('ledChange');
    this.ledAlarm = document.getElementById('ledAlarm');
    this.statusBanner = document.getElementById('machineStatusBanner');
  }

  bindEvents() {
    // Coin Buttons
    document.querySelectorAll('.coin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = parseInt(btn.getAttribute('data-coin-val'), 10);
        this.fsm.insertCoin(val);
        this.flashCoinFeedback(val);
      });
    });

    // Item Buttons
    document.querySelectorAll('.item-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-item-id');
        this.fsm.selectItem(itemId);
      });
    });

    // Refund / Cancel Button - Strict refund conditions
    if (this.btnCancelRefund) {
      this.btnCancelRefund.addEventListener('click', () => {
        if (this.fsm.accumulator > 0) {
          const res = this.fsm.pressCancelRefund(0);
          if (res.success) {
            this.flashStatus(`Refunded inserted balance of ₹${res.amount}. Dispensing change.`);
            this.playCoinSound();
          }
        } else if (this.uncollectedItem !== null && !this.itemCollected) {
          const itemPrice = this.uncollectedItem.price;
          const itemName = this.uncollectedItem.name;
          const res = this.fsm.pressCancelRefund(itemPrice);
          if (res.success) {
            this.uncollectedItem = null;
            if (this.dispensedTray) {
              this.dispensedTray.innerHTML = '<span style="color:#ff7b72; font-size:0.75rem;">Item cancelled & returned.</span>';
            }
            this.flashStatus(`Cancelled uncollected ${itemName}. Refund of ₹${itemPrice} dispensed!`);
            this.playCoinSound();
          }
        } else if (this.itemCollected) {
          this.flashStatus('⚠️ Refund rejected: Item has already been collected.');
          this.playAlarmSound();
        } else {
          this.flashStatus('⚠️ No balance or uncollected items to refund.');
          this.playAlarmSound();
        }
      });
    }

    // Single Step Clock Edge
    if (this.btnStepClk) {
      this.btnStepClk.addEventListener('click', () => {
        this.fsm.clockPulse();
      });
    }

    // Auto / Manual Clock Toggle
    if (this.btnAutoClk) {
      this.btnAutoClk.addEventListener('click', () => {
        this.toggleAutoClock();
      });
    }

    // Frequency Selector
    if (this.freqSelector) {
      this.freqSelector.addEventListener('change', (e) => {
        this.clockFrequencyHz = parseFloat(e.target.value);
        if (this.isAutoClock) {
          this.stopAutoClock();
          this.startAutoClock();
        }
      });
    }

    // Reset Button
    if (this.btnReset) {
      this.btnReset.addEventListener('mousedown', () => {
        this.fsm.assertReset(false); // Active Low assertion
      });
      this.btnReset.addEventListener('mouseup', () => {
        this.fsm.releaseReset();
      });
      this.btnReset.addEventListener('mouseleave', () => {
        this.fsm.releaseReset();
      });
    }

    // Click change tray to pick up coins
    if (this.changeCoinsTray) {
      this.changeCoinsTray.parentElement.addEventListener('click', () => {
        this.changeCoinsTray.innerHTML = '<span style="color:#536b8e; font-size:0.75rem;">Change tray empty</span>';
      });
    }

    // Click dispensed tray to collect item
    if (this.dispensedTray) {
      this.dispensedTray.parentElement.addEventListener('click', () => {
        if (this.uncollectedItem) {
          this.uncollectedItem = null;
          this.itemCollected = true;
          this.dispensedTray.innerHTML = '<span style="color:#536b8e; font-size:0.75rem;">Door closed. Waiting...</span>';
          this.flashStatus('Item collected! Enjoy your refreshment.');
        }
      });
    }

    // Audio Toggle Button
    this.btnToggleAudio = document.getElementById('btnToggleAudio');
    if (this.btnToggleAudio) {
      this.btnToggleAudio.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        this.btnToggleAudio.textContent = this.soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
        this.btnToggleAudio.classList.toggle('btn-primary', this.soundEnabled);
        this.btnToggleAudio.classList.toggle('btn-secondary', !this.soundEnabled);
      });
    }
  }

  ensureAudio() {
    if (!this.soundEnabled) return false;
    if (!this.audioCtx) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioCtx();
      } catch (e) {
        return false;
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return true;
  }

  playCoinSound() {
    if (!this.ensureAudio()) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.08);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playDispenseSound() {
    if (!this.ensureAudio()) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  playAlarmSound() {
    if (!this.ensureAudio()) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.setValueAtTime(320, now + 0.1);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  playChangeSound() {
    if (!this.ensureAudio()) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1900, now);
    osc.frequency.exponentialRampToValueAtTime(2200, now + 0.05);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  startAutoClock() {
    this.isAutoClock = true;
    if (this.btnAutoClk) {
      this.btnAutoClk.classList.add('btn-primary');
      this.btnAutoClk.classList.remove('btn-secondary');
      this.btnAutoClk.textContent = '⏸ Auto Clock: ON';
    }
    const intervalMs = Math.round(1000 / this.clockFrequencyHz);
    this.autoClockTimer = setInterval(() => {
      this.fsm.clockPulse();
    }, intervalMs);
  }

  stopAutoClock() {
    this.isAutoClock = false;
    if (this.autoClockTimer) {
      clearInterval(this.autoClockTimer);
      this.autoClockTimer = null;
    }
    if (this.btnAutoClk) {
      this.btnAutoClk.classList.remove('btn-primary');
      this.btnAutoClk.classList.add('btn-secondary');
      this.btnAutoClk.textContent = '▶ Auto Clock: OFF';
    }
  }

  toggleAutoClock() {
    if (this.isAutoClock) {
      this.stopAutoClock();
    } else {
      this.startAutoClock();
    }
  }

  flashCoinFeedback(val) {
    if (this.statusBanner) {
      this.statusBanner.textContent = `COIN INSERTED: ₹${val} (Coin sensor pulse asserted)`;
      this.statusBanner.style.color = 'var(--cyan-neon)';
    }
  }

  // Update 7-segment displays for digits (e.g. "15" -> tens digit 1, ones digit 5)
  updateSevenSegmentDisplay(prefix, value) {
    const strVal = String(value).padStart(2, '0');
    const tensChar = strVal[strVal.length - 2] || '0';
    const onesChar = strVal[strVal.length - 1] || '0';

    this.renderSingleSevenSeg(`${prefix}Tens`, tensChar);
    this.renderSingleSevenSeg(`${prefix}Ones`, onesChar);
  }

  renderSingleSevenSeg(containerId, char) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const segments = this.segmentMap[char] || this.segmentMap['-'];
    const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    segNames.forEach((name, idx) => {
      const polygon = el.querySelector(`.seg-${name}`);
      if (polygon) {
        if (segments[idx] === 1) {
          polygon.classList.add('on');
        } else {
          polygon.classList.remove('on');
        }
      }
    });
  }

  onTelemetryUpdate(telemetry) {
    // 1. Clock LED strobe
    if (this.clkLed) {
      if (telemetry.clockState === 1) {
        this.clkLed.classList.add('high');
      } else {
        this.clkLed.classList.remove('high');
      }
    }

    if (this.clkCycleVal) {
      this.clkCycleVal.textContent = `#${telemetry.clockCycle}`;
    }

    // 2. 7-Segment Displays Update
    this.updateSevenSegmentDisplay('balanceSeg', telemetry.accumulator);
    const itemCost = telemetry.selectedPrice || (telemetry.selectedItem ? telemetry.selectedItem.price : 0);
    this.updateSevenSegmentDisplay('priceSeg', itemCost);

    // 3. State Indicators
    if (this.currentStatePill) {
      this.currentStatePill.textContent = telemetry.currentStateName;
    }
    if (this.nextStatePill) {
      this.nextStatePill.textContent = telemetry.nextStateName;
    }

    // 4. Binary Bit Monitors
    const qBits = [telemetry.q2, telemetry.q1, telemetry.q0];
    ['bitQ2', 'bitQ1', 'bitQ0'].forEach((id, idx) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = qBits[idx];
        if (qBits[idx] === 1) el.classList.add('one');
        else el.classList.remove('one');
      }
    });

    // 8-bit Accumulator Bits (B7 ... B0)
    const accBin = telemetry.accumulatorBinary;
    for (let i = 0; i < 8; i++) {
      const bitEl = document.getElementById(`bitAcc${7 - i}`);
      if (bitEl) {
        const val = accBin[i];
        bitEl.textContent = val;
        if (val === '1') bitEl.classList.add('one');
        else bitEl.classList.remove('one');
      }
    }

    // Hex and Dec values
    if (this.hexBalanceDisplay) this.hexBalanceDisplay.textContent = telemetry.accumulatorHex;
    if (this.decBalanceDisplay) this.decBalanceDisplay.textContent = `₹${telemetry.accumulator}`;

    // 5. Output Actuator LEDs
    if (this.ledDispense) {
      if (telemetry.dispenseEnable) this.ledDispense.classList.add('high');
      else this.ledDispense.classList.remove('high');
    }
    if (this.ledChange) {
      if (telemetry.coinReturnPulse) this.ledChange.classList.add('high');
      else this.ledChange.classList.remove('high');
    }
    if (this.ledAlarm) {
      if (telemetry.insufficientAlarm) this.ledAlarm.classList.add('high');
      else this.ledAlarm.classList.remove('high');
    }

    // 6. Dispense Action Trigger
    if (telemetry.dispenseEnable && telemetry.dispenseItemCode) {
      this.playDispenseSound();
      this.uncollectedItem = telemetry.selectedItem;
      this.itemCollected = false;
      this.triggerDispenseAnimation(telemetry.dispenseItemCode);

      if (telemetry.latestBill) {
        this.latestBill = telemetry.latestBill;
        const btnView = document.getElementById('btnViewBill');
        if (btnView) {
          btnView.style.display = 'inline-block';
          btnView.onclick = () => this.showBillModal(this.latestBill);
        }
        this.showBillModal(telemetry.latestBill);
      }
    }

    // 7. Change Return Trigger
    if (telemetry.coinReturnPulse && telemetry.changeDispensedCoin > 0) {
      this.triggerChangeReturnCoin(telemetry.changeDispensedCoin);
    }

    // 8. Update SVG Diagrams & Waveform
    if (this.diagram) {
      this.diagram.updateFsmVisualState(telemetry.currentState);
    }
    if (this.waveform) {
      this.waveform.recordSample(telemetry);
    }

    // 9. Status Banner Info
    if (this.statusBanner) {
      if (telemetry.coinRejectMealy) {
        this.statusBanner.textContent = 'MEALY ALERT: Coin rejected! Machine is busy dispensing.';
        this.statusBanner.style.color = 'var(--crimson-neon)';
      } else if (telemetry.insufficientAlarm) {
        this.statusBanner.textContent = 'ALARM: Insufficient balance for selected item. Insert more coins.';
        this.statusBanner.style.color = 'var(--amber-neon)';
      } else if (telemetry.dispenseEnable) {
        this.statusBanner.textContent = `DISPENSING: Motor active for Item ${telemetry.dispenseItemCode}...`;
        this.statusBanner.style.color = 'var(--emerald-neon)';
      } else if (telemetry.coinReturnPulse) {
        this.statusBanner.textContent = `RETURNING CHANGE: Dispensing ₹${telemetry.changeDispensedCoin} coin...`;
        this.statusBanner.style.color = 'var(--amber-neon)';
      } else if (telemetry.currentState === 0) {
        this.statusBanner.textContent = 'READY: Insert coins (₹1, ₹2, ₹5, ₹10) or choose item.';
        this.statusBanner.style.color = 'var(--text-secondary)';
      }
    }
  }

  triggerDispenseAnimation(itemCode) {
    if (!this.dispensedTray) return;
    const itemMap = {
      'A': { icon: '🥤', name: 'Cold Soda' },
      'B': { icon: '☕', name: 'Nitro Coffee' },
      'C': { icon: '🍫', name: 'Energy Bar' },
      'D': { icon: '💧', name: 'Spring Water' }
    };
    const item = itemMap[itemCode] || { icon: '📦', name: 'Item' };

    this.dispensedTray.innerHTML = `
      <div class="dispensed-can" title="Click to collect">
        ${item.icon}
        <div style="font-size:0.7rem; color:var(--cyan-neon); font-family:var(--font-mono);">${item.name}</div>
      </div>
    `;
  }

  triggerChangeReturnCoin(val) {
    if (!this.changeCoinsTray) return;
    if (this.changeCoinsTray.innerHTML.includes('Change tray empty')) {
      this.changeCoinsTray.innerHTML = '';
    }
    const coinEl = document.createElement('div');
    coinEl.className = 'mini-coin';
    coinEl.textContent = `₹${val}`;
    coinEl.title = `₹${val} coin - click tray to collect`;
    this.changeCoinsTray.appendChild(coinEl);
  }
  flashStatus(msg) {
    if (this.statusBanner) {
      this.statusBanner.textContent = msg;
    }
  }

  showBillModal(bill) {
    if (!bill) return;
    let modal = document.getElementById('dsdBillModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'dsdBillModal';
      modal.className = 'bill-modal-overlay';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bill-modal-card">
        <div class="bill-header">
          <div style="font-family:var(--font-mono); font-size:1.05rem; font-weight:800; color:var(--cyan-neon); letter-spacing:1px;">
            ⚡ SMART VENDING MACHINE CONTROLLER
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); margin-top:4px;">
            DIGITAL SYSTEM DESIGN CONTROLLER // INVOICE
          </div>
        </div>

        <div class="bill-body">
          <div class="bill-row">
            <span style="color:var(--text-muted);">INVOICE NO:</span>
            <span style="color:var(--cyan-neon); font-weight:700;">#${bill.billNo}</span>
          </div>
          <div class="bill-row">
            <span style="color:var(--text-muted);">DATE / TIME:</span>
            <span>${bill.date} ${bill.time}</span>
          </div>
          <div class="bill-row">
            <span style="color:var(--text-muted);">PAYMENT STATUS:</span>
            <span style="color:var(--emerald-neon); font-weight:700;">PAID (SUCCESS)</span>
          </div>

          <div class="bill-divider"></div>

          <div class="bill-row" style="font-weight:700; color:var(--cyan-neon); font-size:0.8rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:4px;">
            <span>ITEM</span>
            <span>QTY</span>
            <span>PRICE</span>
          </div>

          <div class="bill-row" style="margin-top:8px;">
            <span>${bill.itemIcon} ${bill.itemName}</span>
            <span>1</span>
            <span style="font-weight:700;">₹${bill.itemPrice}</span>
          </div>

          <div class="bill-divider"></div>

          <div class="bill-row">
            <span style="color:var(--text-secondary);">Subtotal:</span>
            <span>₹${bill.itemPrice}</span>
          </div>
          <div class="bill-row">
            <span style="color:var(--text-secondary);">Cash Inserted:</span>
            <span style="color:var(--amber-neon); font-weight:700;">₹${bill.amountPaid}</span>
          </div>
          <div class="bill-row" style="font-size:1.05rem; font-weight:800; color:var(--emerald-neon); margin-top:6px; padding-top:6px; border-top:1px dashed var(--border-color);">
            <span>Change Returned:</span>
            <span>₹${bill.changeGiven}</span>
          </div>

          <div style="margin-top:14px; background:rgba(0,0,0,0.4); padding:8px 12px; border-radius:6px; font-size:0.72rem; color:var(--text-muted);">
            <div>FSM Latency: ${bill.cycles} Clock Cycles</div>
            <div>Auth Token: FPGA-FSM-0x${bill.billNo.slice(-4)}</div>
          </div>
        </div>

        <div class="bill-footer">
          <button class="btn-primary" onclick="window.print()" style="padding:6px 14px; font-size:0.78rem;">
            🖨️ Print Receipt
          </button>
          <button class="btn-secondary" onclick="document.getElementById('dsdBillModal').classList.remove('open')" style="padding:6px 14px; font-size:0.78rem;">
            Close (✕)
          </button>
        </div>
      </div>
    `;

    setTimeout(() => {
      modal.classList.add('open');
    }, 100);
  }
}

window.SimulatorUI = SimulatorUI;

