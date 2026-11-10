/**
 * SMART VENDING MACHINE CONTROLLER - DIGITAL SYSTEM DESIGN
 * js/fsm-engine.js: Synthesizable FSM & Datapath Logic Engine
 *
 * Implements synchronous sequential logic matching actual Verilog RTL.
 * Registers update strictly on rising clock edges (posedge CLK).
 */

class VendingMachineFSM {
  // State Encodings
  static STATES = {
    IDLE: 0,           // 3'b000 | 5'b00001
    ACCUMULATE: 1,     // 3'b001 | 5'b00010
    SELECT: 2,         // 3'b010 | 5'b00100
    DISPENSE: 3,       // 3'b011 | 5'b01000
    RETURN_CHANGE: 4   // 3'b100 | 5'b10000
  };

  static STATE_NAMES = {
    0: 'S_IDLE',
    1: 'S_ACCUMULATE',
    2: 'S_SELECT',
    3: 'S_DISPENSE',
    4: 'S_RETURN_CHANGE'
  };

  static ITEMS = {
    'itemA': { id: 'A', name: 'Cold Soda', price: 15, stock: 5, icon: '🥤' },
    'itemB': { id: 'B', name: 'Nitro Coffee', price: 20, stock: 4, icon: '☕' },
    'itemC': { id: 'C', name: 'Energy Bar', price: 10, stock: 6, icon: '🍫' },
    'itemD': { id: 'D', name: 'Spring Water', price: 5, stock: 8, icon: '💧' }
  };

  constructor() {
    // Hardware State Memory (Flip-Flops)
    this.currentState = VendingMachineFSM.STATES.IDLE;
    this.nextState = VendingMachineFSM.STATES.IDLE;

    // Inventory levels for each rack
    this.inventory = {
      'itemA': 5,
      'itemB': 4,
      'itemC': 6,
      'itemD': 8
    };
    this.outOfStockAlert = false;

    // Datapath Registers (8-bit registers)
    this.accumulator = 0;      // Balance register ACC[7:0]
    this.changeDue = 0;         // Change register CHG[7:0]
    this.selectedItem = null;   // Item buffer
    this.selectedPrice = 0;     // Price register

    // Input latches (sampled at clock edge)
    this.inputCoinVal = 0;      // 0, 1, 2, 5, 10
    this.inputCoinValid = false;
    this.inputItemRequest = null;
    this.inputCancel = false;
    this.resetN = true;         // Active-low synchronous/asynchronous reset

    // Output Flags & Actuator signals (Moore & Mealy outputs)
    this.dispenseEnable = false;
    this.dispenseItemCode = null;
    this.coinReturnPulse = false;
    this.changeDispensedCoin = 0;
    this.insufficientAlarm = false;
    this.coinRejectMealy = false; // Asynchronous Mealy output

    // Metrics & Clock Tracking
    this.clockCycleCount = 0;
    this.clockState = 0; // 0 = LOW, 1 = HIGH
    this.latestBill = null;
    this.listeners = [];
  }

  // Subscribe to clock ticks & state changes
  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    const telemetry = this.getTelemetry();
    for (const cb of this.listeners) {
      cb(telemetry);
    }
  }

  // Set Inputs
  insertCoin(denomination) {
    if ([1, 2, 5, 10].includes(denomination)) {
      // In states DISPENSE or RETURN_CHANGE, coins cannot be accepted
      if (this.currentState === VendingMachineFSM.STATES.DISPENSE ||
          this.currentState === VendingMachineFSM.STATES.RETURN_CHANGE) {
        this.coinRejectMealy = true;
        this.notify();
        setTimeout(() => { this.coinRejectMealy = false; this.notify(); }, 600);
        return false;
      }
      this.inputCoinVal = denomination;
      this.inputCoinValid = true;
      this.coinRejectMealy = false;
      this.computeNextState();
      this.notify();
      return true;
    }
    return false;
  }

  selectItem(itemId) {
    if (VendingMachineFSM.ITEMS[itemId]) {
      this.inputItemRequest = itemId;
      this.computeNextState();
      this.notify();
      return true;
    }
    return false;
  }

  pressCancelRefund(extraRefundAmount = 0) {
    const totalRefundable = this.accumulator + extraRefundAmount;
    if (totalRefundable <= 0) {
      return { success: false, reason: 'NO_FUNDS', amount: 0 };
    }
    if (this.currentState === VendingMachineFSM.STATES.RETURN_CHANGE && this.changeDue > 0) {
      return { success: false, reason: 'BUSY_DISPENSING', amount: 0 };
    }

    // Set changeDue to EXACTLY the refund amount
    this.changeDue = totalRefundable;
    this.accumulator = 0;
    this.inputCancel = false;
    this.inputCoinValid = false;
    this.inputCoinVal = 0;
    this.inputItemRequest = null;
    this.currentState = VendingMachineFSM.STATES.RETURN_CHANGE;
    this.nextState = VendingMachineFSM.STATES.RETURN_CHANGE;
    this.computeNextState();
    this.notify();
    return { success: true, amount: totalRefundable };
  }

  assertReset(activeLow = false) {
    this.resetN = activeLow;
    if (!this.resetN) {
      // Hardware Asynchronous Reset directly clears registers
      this.currentState = VendingMachineFSM.STATES.IDLE;
      this.nextState = VendingMachineFSM.STATES.IDLE;
      this.accumulator = 0;
      this.changeDue = 0;
      this.selectedItem = null;
      this.selectedPrice = 0;
      this.dispenseEnable = false;
      this.dispenseItemCode = null;
      this.coinReturnPulse = false;
      this.changeDispensedCoin = 0;
      this.insufficientAlarm = false;
      this.inputCoinValid = false;
      this.inputCoinVal = 0;
      this.inputItemRequest = null;
      this.inputCancel = false;
    }
    this.notify();
  }

  releaseReset() {
    this.resetN = true;
    this.notify();
  }

  /**
   * Combinational Logic: Compute Next State (D2, D1, D0)
   * Derived from State Transition Table & K-Map Equations.
   */
  computeNextState() {
    if (!this.resetN) {
      this.nextState = VendingMachineFSM.STATES.IDLE;
      return;
    }

    switch (this.currentState) {
      case VendingMachineFSM.STATES.IDLE:
        if (this.inputCoinValid) {
          this.nextState = VendingMachineFSM.STATES.ACCUMULATE;
        } else {
          this.nextState = VendingMachineFSM.STATES.IDLE;
        }
        break;

      case VendingMachineFSM.STATES.ACCUMULATE:
        if (this.inputCancel) {
          this.nextState = VendingMachineFSM.STATES.RETURN_CHANGE;
        } else if (this.inputItemRequest) {
          this.nextState = VendingMachineFSM.STATES.SELECT;
        } else if (this.inputCoinValid) {
          // Remain in accumulate as more coins enter
          this.nextState = VendingMachineFSM.STATES.ACCUMULATE;
        } else {
          // Wait for user action
          this.nextState = VendingMachineFSM.STATES.ACCUMULATE;
        }
        break;

      case VendingMachineFSM.STATES.SELECT:
        if (this.inputCancel) {
          this.nextState = VendingMachineFSM.STATES.RETURN_CHANGE;
        } else if (this.inputItemRequest) {
          const item = VendingMachineFSM.ITEMS[this.inputItemRequest];
          // Comparator Datapath: ACC >= Price ?
          if (this.accumulator >= item.price) {
            this.nextState = VendingMachineFSM.STATES.DISPENSE;
          } else {
            // Insufficient funds: stay in ACCUMULATE
            this.nextState = VendingMachineFSM.STATES.ACCUMULATE;
          }
        } else {
          this.nextState = VendingMachineFSM.STATES.ACCUMULATE;
        }
        break;

      case VendingMachineFSM.STATES.DISPENSE:
        // After dispense pulse completes, check if change is owed
        const remainingChange = this.accumulator - this.selectedPrice;
        if (remainingChange > 0) {
          this.nextState = VendingMachineFSM.STATES.RETURN_CHANGE;
        } else {
          this.nextState = VendingMachineFSM.STATES.IDLE;
        }
        break;

      case VendingMachineFSM.STATES.RETURN_CHANGE:
        // If change counter hits zero on next cycle, return to IDLE
        if (this.changeDue <= 0) {
          this.nextState = VendingMachineFSM.STATES.IDLE;
        } else {
          this.nextState = VendingMachineFSM.STATES.RETURN_CHANGE;
        }
        break;

      default:
        this.nextState = VendingMachineFSM.STATES.IDLE;
    }
  }

  /**
   * Synchronous Rising Clock Edge (posedge CLK)
   * All D-Flip Flops sample inputs and update outputs simultaneously.
   */
  clockPulse() {
    this.clockCycleCount++;
    this.clockState = 1;

    // 1. Reset condition
    if (!this.resetN) {
      this.currentState = VendingMachineFSM.STATES.IDLE;
      this.accumulator = 0;
      this.changeDue = 0;
      this.notify();
      setTimeout(() => { this.clockState = 0; this.notify(); }, 80);
      return;
    }

    // 2. Next State Logic evaluation
    this.computeNextState();

    // 3. Sequential Register Updates & Datapath Operations
    const priorState = this.currentState;
    this.currentState = this.nextState;

    // Reset single-cycle control flags
    this.dispenseEnable = false;
    this.coinReturnPulse = false;
    this.insufficientAlarm = false;
    this.changeDispensedCoin = 0;

    // Datapath Execution based on State Transitions
    if (this.currentState === VendingMachineFSM.STATES.ACCUMULATE) {
      if (this.inputCoinValid) {
        // Ripple Carry Adder execution: ACC <= ACC + Coin
        this.accumulator = Math.min(255, this.accumulator + this.inputCoinVal);
        this.inputCoinValid = false;
        this.inputCoinVal = 0;
      }
      if (this.inputItemRequest && priorState === VendingMachineFSM.STATES.SELECT) {
        const item = VendingMachineFSM.ITEMS[this.inputItemRequest];
        if (this.accumulator < item.price) {
          this.insufficientAlarm = true;
        }
      }
    } else if (this.currentState === VendingMachineFSM.STATES.SELECT) {
      if (this.inputItemRequest) {
        const item = VendingMachineFSM.ITEMS[this.inputItemRequest];
        this.selectedItem = item;
        this.selectedPrice = item.price;
        if (this.accumulator < item.price) {
          this.insufficientAlarm = true;
          this.nextState = VendingMachineFSM.STATES.ACCUMULATE;
        } else {
          this.nextState = VendingMachineFSM.STATES.DISPENSE;
        }
      }
      this.inputItemRequest = null;
    } else if (this.currentState === VendingMachineFSM.STATES.DISPENSE) {
      // Moore Output: Assert Dispense Enable Pulse
      this.dispenseEnable = true;
      this.dispenseItemCode = this.selectedItem ? this.selectedItem.id : null;

      // Calculate change register: CHG <= ACC - Price
      const priorAccumulator = this.accumulator;
      const price = this.selectedPrice;
      this.changeDue = Math.max(0, priorAccumulator - price);
      this.accumulator = 0; // Transferred to purchase & change
      this.inputCancel = false;

      // Generate Bill for this payment
      this.latestBill = {
        billNo: `DSD-${Math.floor(100000 + Math.random() * 900000)}`,
        date: new Date().toLocaleDateString('en-GB'),
        time: new Date().toLocaleTimeString(),
        itemName: this.selectedItem ? this.selectedItem.name : 'Vended Item',
        itemIcon: this.selectedItem ? this.selectedItem.icon : '🥤',
        itemPrice: price,
        amountPaid: priorAccumulator,
        changeGiven: this.changeDue,
        cycles: this.clockCycleCount
      };
    } else if (this.currentState === VendingMachineFSM.STATES.RETURN_CHANGE) {
      // Change Dispenser Logic: dispense largest possible coin per cycle (Greedy coin return)
      if (this.changeDue >= 10) {
        this.changeDispensedCoin = 10;
        this.changeDue -= 10;
        this.coinReturnPulse = true;
      } else if (this.changeDue >= 5) {
        this.changeDispensedCoin = 5;
        this.changeDue -= 5;
        this.coinReturnPulse = true;
      } else if (this.changeDue >= 2) {
        this.changeDispensedCoin = 2;
        this.changeDue -= 2;
        this.coinReturnPulse = true;
      } else if (this.changeDue >= 1) {
        this.changeDispensedCoin = 1;
        this.changeDue -= 1;
        this.coinReturnPulse = true;
      }

      if (this.changeDue <= 0) {
        this.changeDue = 0;
        this.nextState = VendingMachineFSM.STATES.IDLE;
      }
    } else if (this.currentState === VendingMachineFSM.STATES.IDLE) {
      // Clear transaction memory
      this.selectedItem = null;
      this.selectedPrice = 0;
      this.inputCancel = false;
      this.inputItemRequest = null;
      this.changeDue = 0;
    }

    // Prepare next state for upcoming cycle
    this.computeNextState();

    this.notify();

    // Fall clock back to 0 after brief propagation delay
    setTimeout(() => {
      this.clockState = 0;
      this.notify();
    }, 120);
  }

  // Telemetry Snapshot for UI, Canvas & Waveforms
  getTelemetry() {
    const q = this.currentState;
    const q2 = (q >> 2) & 1;
    const q1 = (q >> 1) & 1;
    const q0 = q & 1;

    // One-Hot Encoding: 5-bit vector
    const oneHot = [
      q === 0 ? 1 : 0,
      q === 1 ? 1 : 0,
      q === 2 ? 1 : 0,
      q === 3 ? 1 : 0,
      q === 4 ? 1 : 0
    ];

    return {
      clockCycle: this.clockCycleCount,
      clockState: this.clockState,
      resetN: this.resetN,
      currentState: this.currentState,
      currentStateName: VendingMachineFSM.STATE_NAMES[this.currentState],
      nextState: this.nextState,
      nextStateName: VendingMachineFSM.STATE_NAMES[this.nextState],
      stateBitsBinary: `${q2}${q1}${q0}`,
      q2, q1, q0,
      stateBitsOneHot: oneHot.slice().reverse().join(''),
      accumulator: this.accumulator,
      accumulatorBinary: this.accumulator.toString(2).padStart(8, '0'),
      accumulatorHex: '0x' + this.accumulator.toString(16).toUpperCase().padStart(2, '0'),
      changeDue: this.changeDue,
      selectedItem: this.selectedItem,
      selectedPrice: this.selectedPrice,
      dispenseEnable: this.dispenseEnable,
      dispenseItemCode: this.dispenseItemCode,
      coinReturnPulse: this.coinReturnPulse,
      changeDispensedCoin: this.changeDispensedCoin,
      insufficientAlarm: this.insufficientAlarm,
      coinRejectMealy: this.coinRejectMealy,
      inputCoinValid: this.inputCoinValid,
      inputCoinVal: this.inputCoinVal,
      latestBill: this.latestBill
    };
  }
}

// Export for browser
window.VendingMachineFSM = VendingMachineFSM;

