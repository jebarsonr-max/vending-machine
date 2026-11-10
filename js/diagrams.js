/**
 * SMART VENDING MACHINE CONTROLLER - DIGITAL SYSTEM DESIGN
 * js/diagrams.js: Interactive Architecture Diagrams, FSM Graphs & K-Maps
 */

class DiagramController {
  constructor() {
    this.blockData = {
      'inputs': {
        title: 'System Input Peripherals & Debouncers',
        desc: 'Captures mechanical coin slots (₹1, ₹2, ₹5, ₹10) and capacitive touch pushbuttons. Employs hardware Schmitt-trigger debounce filters and synchronizer flip-flops to prevent metastability when crossing into the 100MHz clock domain.',
        pins: ['Cin[3:0]', 'Sel[3:0]', 'Cancel_Btn', 'CLK_100M', 'RST_N']
      },
      'fsm': {
        title: 'Central Finite State Machine (Moore & Mealy Controller)',
        desc: '3-bit sequential controller maintaining states S_IDLE, S_ACCUMULATE, S_SELECT, S_DISPENSE, and S_RETURN_CHANGE. Synthesized with D-type flip-flops and minimum-gate SOP next-state logic.',
        pins: ['Q[2:0]', 'Next_Q[2:0]', 'En_Acc', 'En_Comp', 'En_Disp', 'En_Chg']
      },
      'datapath': {
        title: 'Arithmetic Datapath Unit (Adder & Comparator)',
        desc: 'Contains an 8-bit ripple-carry adder for coin accumulation, an 8-bit magnitude comparator (ACC >= Price), and a greedy change-subtractor unit.',
        pins: ['Acc[7:0]', 'Price[7:0]', 'Sum[7:0]', 'Comp_GTE (Flag)', 'Chg_Rem[7:0]']
      },
      'outputs': {
        title: 'Actuator Drivers & Output Decoders',
        desc: 'Glitch-free registered outputs driving 24V solenoid dispenser coils via Darlington power arrays, servo change dispenser, and dual BCD 7-segment LED driver modules.',
        pins: ['Motor_En[3:0]', 'Chg_Solenoid_Pulse', 'Disp_LED[3:0]', 'HEX0[6:0]', 'HEX1[6:0]']
      }
    };

    this.initBlockDiagramHover();
    this.initKmapTabs();
  }

  initBlockDiagramHover() {
    const blocks = document.querySelectorAll('.block-hoverable');
    const infoTitle = document.getElementById('archInfoTitle');
    const infoDesc = document.getElementById('archInfoDesc');
    const pinsContainer = document.getElementById('archInfoPins');

    if (!blocks.length || !infoTitle) return;

    blocks.forEach(block => {
      block.addEventListener('click', () => {
        blocks.forEach(b => b.classList.remove('active'));
        block.classList.add('active');

        const blockId = block.getAttribute('data-block-id');
        const data = this.blockData[blockId];
        if (data) {
          infoTitle.textContent = data.title;
          infoDesc.textContent = data.desc;
          pinsContainer.innerHTML = data.pins.map(pin => `<span class="pin-chip">${pin}</span>`).join('');
        }
      });
    });
  }

  // Update live state node in the FSM SVG
  updateFsmVisualState(stateIndex) {
    const stateNodes = document.querySelectorAll('.state-node');
    stateNodes.forEach(node => {
      const nodeState = parseInt(node.getAttribute('data-state-index'), 10);
      if (nodeState === stateIndex) {
        node.classList.add('state-active');
      } else {
        node.classList.remove('state-active');
      }
    });

    // Update active row in state table
    const tableRows = document.querySelectorAll('.dsd-table tbody tr');
    tableRows.forEach(row => {
      const rowState = parseInt(row.getAttribute('data-state-index'), 10);
      if (rowState === stateIndex) {
        row.classList.add('active-row');
      } else {
        row.classList.remove('active-row');
      }
    });
  }

  initKmapTabs() {
    const stepBtns = document.querySelectorAll('.step-btn');
    const stepPanes = document.querySelectorAll('.process-pane');

    stepBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const stepTarget = btn.getAttribute('data-step-target');

        stepBtns.forEach(b => b.classList.remove('active'));
        stepPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const activePane = document.getElementById(stepTarget);
        if (activePane) activePane.classList.add('active');
      });
    });

    // State Encoding Comparison Tabs
    const metaBtns = document.querySelectorAll('.meta-tab-btn');
    const metaPanes = document.querySelectorAll('.fsm-meta-pane');
    metaBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-meta-target');
        metaBtns.forEach(b => b.classList.remove('active'));
        metaPanes.forEach(p => p.style.display = 'none');

        btn.classList.add('active');
        const targetEl = document.getElementById(target);
        if (targetEl) targetEl.style.display = 'block';
      });
    });
  }
}

window.DiagramController = DiagramController;

