/**
 * SMART VENDING MACHINE CONTROLLER - DIGITAL SYSTEM DESIGN
 * js/customer-ui.js: Customer Kiosk UI Controller
 *
 * Dedicated to the customer shopping experience:
 * Auto-clocked FSM in background, 7-segment displays, coin drop, item dispenser,
 * change tray, and interactive audio effects. No clock buttons or logic analyzers.
 */

class CustomerVendingUI {
  constructor() {
    this.fsm = new VendingMachineFSM();
    this.soundEnabled = true;
    this.audioCtx = null;

    // Track uncollected items and change for strict refund integrity
    this.uncollectedItem = null;
    this.itemCollected = false;
    this.latestBill = null;

    // Segment Bitmasks for digits 0-9
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

    // Run continuous clock for customer (2 pulses per second for smooth natural vending)
    this.clockTimer = setInterval(() => {
      this.fsm.clockPulse();
    }, 500);

    // Subscribe to FSM telemetry
    this.fsm.subscribe((telemetry) => this.onTelemetryUpdate(telemetry));
  }

  initDOMElements() {
    this.statusBanner = document.getElementById('kioskStatusBanner');
    this.dispensedTray = document.getElementById('dispensedTray');
    this.changeCoinsTray = document.getElementById('changeCoinsTray');
    this.btnCancelRefund = document.getElementById('btnCancelRefund');
    this.btnAudioToggle = document.getElementById('btnAudioToggle');
  }

  bindEvents() {
    // Coin Buttons
    document.querySelectorAll('.coin-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-coin-val'), 10);
        const accepted = this.fsm.insertCoin(val);
        if (accepted) {
          this.playCoinSound();
          this.flashStatus(`Inserted ₹${val}. Select an item or insert more.`);
        } else {
          this.playAlarmSound();
          this.flashStatus(`Coin rejected: machine is currently dispensing!`);
        }
      });
    });

    // Item Buttons
    document.querySelectorAll('.item-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.getAttribute('data-item-id');
        this.fsm.selectItem(itemId);
      });
    });

    // Refund Button - Valid only if item or change is not collected
    if (this.btnCancelRefund) {
      this.btnCancelRefund.addEventListener('click', () => {
        if (this.fsm.accumulator > 0) {
          // Case 1: Balance was inserted and not yet used
          const res = this.fsm.pressCancelRefund(0);
          if (res.success) {
            this.flashStatus(`Transaction cancelled. Dispensing refund of ₹${res.amount}...`);
            this.playCoinSound();
          }
        } else if (this.uncollectedItem !== null && !this.itemCollected) {
          // Case 2: Item was dispensed but NOT collected yet -> can cancel purchase!
          const itemPrice = this.uncollectedItem.price;
          const itemName = this.uncollectedItem.name;
          const res = this.fsm.pressCancelRefund(itemPrice);
          if (res.success) {
            this.uncollectedItem = null;
            if (this.dispensedTray) {
              this.dispensedTray.innerHTML = '<span style="color:#ff7b72; font-size:0.75rem;">Item cancelled & returned.</span>';
            }
            this.flashStatus(`Purchase cancelled before collection. Full refund of ₹${itemPrice} dispensed!`);
            this.playCoinSound();
          }
        } else if (this.itemCollected) {
          // Case 3: Item was already collected
          this.flashStatus('⚠️ Refund denied: Item has already been collected.');
          this.playAlarmSound();
        } else {
          // Case 4: No money or items
          this.flashStatus('⚠️ No balance or uncollected items to refund.');
          this.playAlarmSound();
        }
      });
    }

    // Audio Toggle
    if (this.btnAudioToggle) {
      this.btnAudioToggle.addEventListener('click', () => {
        this.soundEnabled = !this.soundEnabled;
        this.btnAudioToggle.textContent = this.soundEnabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
      });
    }

    // Click item tray to pick up item
    if (this.dispensedTray) {
      this.dispensedTray.parentElement.addEventListener('click', () => {
        if (this.uncollectedItem) {
          this.uncollectedItem = null;
          this.itemCollected = true;
          this.dispensedTray.innerHTML = '<span style="color:#536b8e; font-size:0.8rem;">Chute empty. Ready.</span>';
          this.flashStatus('Item collected! Enjoy your refreshment.');
        }
      });
    }

    // Click change tray to pick up coins
    if (this.changeCoinsTray) {
      this.changeCoinsTray.parentElement.addEventListener('click', () => {
        this.changeCoinsTray.innerHTML = '<span style="color:#536b8e; font-size:0.8rem;">Change tray empty</span>';
        this.flashStatus('Change collected! Thank you.');
      });
    }
  }

  flashStatus(msg) {
    if (this.statusBanner) {
      this.statusBanner.textContent = msg;
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
    osc.frequency.exponentialRampToValueAtTime(1900, now + 0.08);
    gain.gain.setValueAtTime(0.2, now);
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
    gain.gain.setValueAtTime(0.25, now);
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
    osc.frequency.setValueAtTime(460, now);
    osc.frequency.setValueAtTime(320, now + 0.1);
    gain.gain.setValueAtTime(0.2, now);
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
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(2200, now + 0.06);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

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
        if (segments[idx] === 1) polygon.classList.add('on');
        else polygon.classList.remove('on');
      }
    });
  }

  onTelemetryUpdate(telemetry) {
    // 1. Update 7-segment displays
    this.updateSevenSegmentDisplay('balanceSeg', telemetry.accumulator);
    const itemCost = telemetry.selectedPrice || (telemetry.selectedItem ? telemetry.selectedItem.price : 0);
    this.updateSevenSegmentDisplay('priceSeg', itemCost);

    // 2. Dispense Action Trigger
    if (telemetry.dispenseEnable && telemetry.dispenseItemCode) {
      this.playDispenseSound();
      this.uncollectedItem = telemetry.selectedItem;
      this.itemCollected = false;
      this.triggerDispense(telemetry.dispenseItemCode);
      this.flashStatus(`Dispensing your ${telemetry.selectedItem ? telemetry.selectedItem.name : 'item'}! Please collect below.`);

      if (telemetry.latestBill) {
        this.latestBill = telemetry.latestBill;
        const btnViewBill = document.getElementById('btnViewBill');
        if (btnViewBill) {
          btnViewBill.style.display = 'inline-block';
          btnViewBill.onclick = () => this.showBillModal(this.latestBill);
        }
        this.showBillModal(telemetry.latestBill);
      }
    }

    // 3. Change Return Trigger
    if (telemetry.coinReturnPulse && telemetry.changeDispensedCoin > 0) {
      this.playChangeSound();
      this.triggerChangeCoin(telemetry.changeDispensedCoin);
      this.flashStatus(`Returning ₹${telemetry.changeDispensedCoin} coin. Please collect from the tray.`);
    }

    // 4. Insufficient Funds Alarm
    if (telemetry.insufficientAlarm) {
      this.playAlarmSound();
      this.flashStatus('⚠️ Insufficient funds! Please insert more coins to purchase this item.');
    }
  }

  triggerDispense(itemCode) {
    if (!this.dispensedTray) return;
    const itemMap = {
      'A': { icon: '🥤', name: 'Cold Soda' },
      'B': { icon: '☕', name: 'Nitro Coffee' },
      'C': { icon: '🍫', name: 'Energy Bar' },
      'D': { icon: '💧', name: 'Spring Water' }
    };
    const item = itemMap[itemCode] || { icon: '📦', name: 'Item' };

    this.dispensedTray.innerHTML = `
      <div class="dispensed-can" title="Click to collect your item!">
        ${item.icon}
        <div style="font-size:0.75rem; color:var(--cyan-neon); font-family:var(--font-mono); font-weight:700;">${item.name}</div>
        <div style="font-size:0.65rem; color:var(--text-secondary);">Click to take</div>
      </div>
    `;
  }

  triggerChangeCoin(val) {
    if (!this.changeCoinsTray) return;
    if (this.changeCoinsTray.innerHTML.includes('Change tray empty') || this.changeCoinsTray.innerHTML.includes('Empty')) {
      this.changeCoinsTray.innerHTML = '';
    }
    const coinEl = document.createElement('div');
    coinEl.className = 'mini-coin';
    coinEl.textContent = `₹${val}`;
    coinEl.title = `₹${val} coin - click tray to collect`;
    this.changeCoinsTray.appendChild(coinEl);
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
            ⚡ SMART VENDING KIOSK
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

document.addEventListener('DOMContentLoaded', () => {
  window.customerKiosk = new CustomerVendingUI();
});

