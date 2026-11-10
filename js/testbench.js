/**
 * SMART VENDING MACHINE CONTROLLER - DIGITAL SYSTEM DESIGN
 * js/testbench.js: Automated Verification Suite & Assertions Engine
 *
 * Runs deterministic stimulus vectors against the FSM model,
 * checking timing assertions and functional correctness.
 */

class FsmTestbench {
  constructor(fsm, simulatorUi) {
    this.fsm = fsm;
    this.simUi = simulatorUi;
    this.isRunning = false;

    this.testDefinitions = [
      {
        id: 1,
        title: 'TC_01: Exact Change Transaction',
        desc: 'Inserts ₹10 + ₹5 (Total ₹15). Selects Item A (Soda, ₹15). Verifies single-cycle dispense pulse and zero change return.',
        run: async () => this.runTestExactChange()
      },
      {
        id: 2,
        title: 'TC_02: Insufficient Funds Inhibit',
        desc: 'Inserts ₹10 only. Selects Item B (Coffee, ₹20). Verifies alarm flag asserted, dispense withheld, balance preserved.',
        run: async () => this.runTestInsufficientFunds()
      },
      {
        id: 3,
        title: 'TC_03: Excess Balance & Change Dispenser',
        desc: 'Inserts ₹10 + ₹10 (Total ₹20). Selects Item A (₹15). Verifies item dispensed, change calculation (₹5), and greedy change return.',
        run: async () => this.runTestExcessChange()
      },
      {
        id: 4,
        title: 'TC_04: Mid-Transaction Cancellation',
        desc: 'Inserts ₹10 + ₹2. Triggers Cancel. Verifies transition to S_RETURN_CHANGE, sequential coin refund, and transition to S_IDLE.',
        run: async () => this.runTestCancellation()
      },
      {
        id: 5,
        title: 'TC_05: Asynchronous Master Reset (RST_N)',
        desc: 'Inserts ₹10. Strobe active-low RST_N = 0 mid-cycle. Verifies instant asynchronous return to S_IDLE and register zeroing.',
        run: async () => this.runTestAsynchronousReset()
      }
    ];

    this.initUI();
  }

  initUI() {
    const container = document.getElementById('testSuiteContainer');
    if (!container) return;

    container.innerHTML = this.testDefinitions.map(tc => `
      <div class="test-card" id="testCard_${tc.id}">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h4 style="font-family:var(--font-mono); color:var(--text-primary); font-size:0.95rem;">${tc.title}</h4>
            <span class="test-badge" id="testBadge_${tc.id}">NOT RUN</span>
          </div>
          <p style="font-size:0.82rem; color:var(--text-secondary); line-height:1.4;">${tc.desc}</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border-subtle); padding-top:10px;">
          <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--text-muted);" id="testLatency_${tc.id}">Latency: -- cycles</span>
          <button class="btn-secondary" style="padding:6px 14px; font-size:0.75rem;" onclick="window.testbenchRunner.runSingleTest(${tc.id})">Execute Test</button>
        </div>
      </div>
    `).join('');

    const runAllBtn = document.getElementById('btnRunAllTests');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', () => this.runAllTests());
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runSingleTest(testId) {
    if (this.isRunning) return;
    const test = this.testDefinitions.find(t => t.id === testId);
    if (!test) return;

    this.isRunning = true;
    const wasAuto = this.simUi.isAutoClock;
    this.simUi.stopAutoClock();

    const badge = document.getElementById(`testBadge_${testId}`);
    const latencyEl = document.getElementById(`testLatency_${testId}`);
    if (badge) {
      badge.textContent = 'RUNNING...';
      badge.className = 'test-badge';
      badge.style.color = 'var(--cyan-neon)';
    }

    // Reset machine state first
    this.fsm.assertReset(false);
    this.fsm.clockPulse();
    this.fsm.releaseReset();
    this.fsm.clockPulse();

    const startCycles = this.fsm.clockCycleCount;

    try {
      const result = await test.run();
      const elapsedCycles = this.fsm.clockCycleCount - startCycles;

      if (badge) {
        badge.textContent = result.pass ? 'PASSED' : 'FAILED';
        badge.className = `test-badge ${result.pass ? 'pass' : 'fail'}`;
      }
      if (latencyEl) {
        latencyEl.textContent = `Latency: ${elapsedCycles} cycles | ${result.msg}`;
      }
    } catch (err) {
      if (badge) {
        badge.textContent = 'ERROR';
        badge.className = 'test-badge fail';
      }
    }

    if (wasAuto) this.simUi.startAutoClock();
    this.isRunning = false;
  }

  async runAllTests() {
    for (const test of this.testDefinitions) {
      await this.runSingleTest(test.id);
      await this.sleep(400);
    }
  }

  // TC_01: Exact Change
  async runTestExactChange() {
    await this.sleep(200);
    this.fsm.insertCoin(10);
    this.fsm.clockPulse();
    await this.sleep(200);

    this.fsm.insertCoin(5);
    this.fsm.clockPulse();
    await this.sleep(200);

    // Verify accumulator has 15
    if (this.fsm.accumulator !== 15) {
      return { pass: false, msg: `Expected ACC=15, got ${this.fsm.accumulator}` };
    }

    // Select Item A
    this.fsm.selectItem('itemA');
    this.fsm.clockPulse(); // Transitions to S_SELECT
    await this.sleep(200);

    this.fsm.clockPulse(); // Transitions to S_DISPENSE
    const dispAsserted = this.fsm.dispenseEnable;
    await this.sleep(200);

    this.fsm.clockPulse(); // Transitions to S_IDLE (exact change)

    const finalState = this.fsm.currentState;
    const pass = dispAsserted && finalState === 0;
    return {
      pass,
      msg: pass ? 'Exact 15 dispensed, returned to IDLE' : 'Assertion failed in dispense'
    };
  }

  // TC_02: Insufficient Funds
  async runTestInsufficientFunds() {
    await this.sleep(200);
    this.fsm.insertCoin(10);
    this.fsm.clockPulse();
    await this.sleep(200);

    // Select Item B (Cost 20)
    this.fsm.selectItem('itemB');
    this.fsm.clockPulse(); // Evaluate in S_SELECT
    await this.sleep(200);

    this.fsm.clockPulse(); // Should return to ACCUMULATE with alarm
    const alarmFired = this.fsm.insufficientAlarm;
    const dispNotFired = !this.fsm.dispenseEnable;
    const accPreserved = (this.fsm.accumulator === 10);

    const pass = alarmFired && dispNotFired && accPreserved;
    return {
      pass,
      msg: pass ? 'Dispense blocked, alarm asserted, ACC preserved' : 'Funds check failure'
    };
  }

  // TC_03: Excess Change
  async runTestExcessChange() {
    await this.sleep(200);
    this.fsm.insertCoin(10);
    this.fsm.clockPulse();
    await this.sleep(200);

    this.fsm.insertCoin(10);
    this.fsm.clockPulse(); // Acc = 20
    await this.sleep(200);

    this.fsm.selectItem('itemA'); // Price 15
    this.fsm.clockPulse(); // SELECT
    await this.sleep(200);

    this.fsm.clockPulse(); // DISPENSE: change register should load 5
    const chgLoaded = (this.fsm.changeDue === 5);
    await this.sleep(200);

    this.fsm.clockPulse(); // S_RETURN_CHANGE: dispenses 5
    const coinReturned = (this.fsm.changeDispensedCoin === 5);
    await this.sleep(200);

    this.fsm.clockPulse(); // S_IDLE
    const pass = chgLoaded && coinReturned && (this.fsm.currentState === 0);
    return {
      pass,
      msg: pass ? 'Dispensed item & ₹5 refund coin' : 'Change calculation error'
    };
  }

  // TC_04: Mid-Transaction Cancellation
  async runTestCancellation() {
    await this.sleep(200);
    this.fsm.insertCoin(10);
    this.fsm.clockPulse();
    await this.sleep(150);

    this.fsm.insertCoin(2);
    this.fsm.clockPulse(); // ACC = 12
    await this.sleep(150);

    this.fsm.pressCancelRefund();
    this.fsm.clockPulse(); // S_RETURN_CHANGE: dispenses ₹10
    const firstCoin = this.fsm.changeDispensedCoin === 10;
    await this.sleep(200);

    this.fsm.clockPulse(); // S_RETURN_CHANGE: dispenses ₹2
    const secondCoin = this.fsm.changeDispensedCoin === 2;
    await this.sleep(200);

    this.fsm.clockPulse(); // S_IDLE
    const pass = firstCoin && secondCoin && (this.fsm.currentState === 0);
    return {
      pass,
      msg: pass ? 'Refunded ₹10 + ₹2, state returned to IDLE' : 'Cancel refund failure'
    };
  }

  // TC_05: Asynchronous RST_N Strobe
  async runTestAsynchronousReset() {
    await this.sleep(200);
    this.fsm.insertCoin(10);
    this.fsm.clockPulse();
    await this.sleep(150);

    // Assert RST_N = 0 asynchronously (no clock edge needed)
    this.fsm.assertReset(false);
    const immediateReset = (this.fsm.currentState === 0 && this.fsm.accumulator === 0);
    await this.sleep(150);

    this.fsm.releaseReset();
    this.fsm.clockPulse();

    const pass = immediateReset && (this.fsm.currentState === 0);
    return {
      pass,
      msg: pass ? 'Asynchronous reset instantly zeroed state and registers' : 'RST_N failure'
    };
  }
}

window.FsmTestbench = FsmTestbench;

