/**
 * SMART VENDING MACHINE CONTROLLER - DIGITAL SYSTEM DESIGN
 * js/app.js: Application Bootstrap, Theme Engine, PCB Canvas & Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Theme Engine (Circuit Dark vs Blueprint Light)
  initThemeEngine();

  // 2. Initialize PCB Background Canvas
  initPcbBackground();

  // 3. Initialize Core Engineering Engine & Simulator
  const fsm = new VendingMachineFSM();
  const diagram = new DiagramController();
  const waveform = new LogicWaveformAnalyzer('waveformCanvas');
  const simulator = new SimulatorUI(fsm, waveform, diagram);
  const testbench = new FsmTestbench(fsm, simulator);

  // Global handle for testbench onclick calls
  window.testbenchRunner = testbench;
  window.activeFsm = fsm;

  // 4. Navigation & Scroll Spy
  initNavigation();

  // 5. Code Syntax Viewer (Verilog vs VHDL tabs)
  initCodeViewer();

  // 6. Interactive 7-Segment Playground
  initSegmentPlayground();

  // 7. Interactive K-Map Highlighter
  initKmapInteractivity();
});

/* --------------------------------------------------------------------------
   THEME ENGINE
   -------------------------------------------------------------------------- */
function initThemeEngine() {
  const toggleBtn = document.getElementById('themeToggleBtn');
  const currentTheme = localStorage.getItem('dsd_theme') || 'dark';

  document.documentElement.setAttribute('data-theme', currentTheme);
  updateThemeIcon(currentTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme');
      const nextTheme = active === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', nextTheme);
      localStorage.setItem('dsd_theme', nextTheme);
      updateThemeIcon(nextTheme);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  if (theme === 'dark') {
    icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    icon.setAttribute('title', 'Switch to Blueprint Light Mode');
  } else {
    icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    icon.setAttribute('title', 'Switch to Circuit Dark Mode');
  }
}

/* --------------------------------------------------------------------------
   PCB BACKGROUND CANVAS (CIRCUIT TRACES & PULSES)
   -------------------------------------------------------------------------- */
function initPcbBackground() {
  const canvas = document.getElementById('pcbCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let w, h;
  const resize = () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  // Generate trace paths
  const traces = [];
  const numTraces = 22;

  for (let i = 0; i < numTraces; i++) {
    const x0 = Math.random() * w;
    const y0 = Math.random() * h;
    const segments = [];
    let curX = x0;
    let curY = y0;

    for (let s = 0; s < 4; s++) {
      const angle = Math.floor(Math.random() * 4) * (Math.PI / 2);
      const len = 40 + Math.random() * 100;
      curX += Math.cos(angle) * len;
      curY += Math.sin(angle) * len;
      segments.push({ x: curX, y: curY });
    }

    traces.push({
      startX: x0,
      startY: y0,
      segments: segments,
      pulsePos: Math.random(),
      speed: 0.003 + Math.random() * 0.005
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.lineWidth = 1.2;

    traces.forEach(trace => {
      ctx.beginPath();
      ctx.moveTo(trace.startX, trace.startY);
      trace.segments.forEach(seg => {
        ctx.lineTo(seg.x, seg.y);
      });
      ctx.stroke();

      // Pad terminal nodes
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(trace.startX, trace.startY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Pulse traveling along trace
      trace.pulsePos += trace.speed;
      if (trace.pulsePos > 1) trace.pulsePos = 0;

      // Approximate position on polyline
      const totalSegs = trace.segments.length;
      const segIndex = Math.min(Math.floor(trace.pulsePos * totalSegs), totalSegs - 1);
      const prevX = segIndex === 0 ? trace.startX : trace.segments[segIndex - 1].x;
      const prevY = segIndex === 0 ? trace.startY : trace.segments[segIndex - 1].y;
      const nextX = trace.segments[segIndex].x;
      const nextY = trace.segments[segIndex].y;
      const segT = (trace.pulsePos * totalSegs) - segIndex;

      const px = prevX + (nextX - prevX) * segT;
      const py = prevY + (nextY - prevY) * segT;

      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    requestAnimationFrame(draw);
  }

  draw();
}

/* --------------------------------------------------------------------------
   NAVIGATION & SCROLL SPY
   -------------------------------------------------------------------------- */
function initNavigation() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const navMenu = document.getElementById('navLinks');

  if (mobileBtn && navMenu) {
    mobileBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
    });
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
      });
    });
  }

  window.addEventListener('scroll', () => {
    let current = '';
    const scrollPos = window.scrollY + 120;

    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        current = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

/* --------------------------------------------------------------------------
   HDL CODE VIEWER (VERILOG VS VHDL)
   -------------------------------------------------------------------------- */
function initCodeViewer() {
  const verilogCode = `// =========================================================================
// MODULE: Vending_Machine_Controller (Synthesizable RTL)
// Target: Xilinx Artix-7 FPGA (xc7a35tcpg236-1)
// Clock:  100 MHz (Synchronous edge-triggered design)
// =========================================================================
\`timescale 1ns / 1ps

module Vending_Machine_Controller (
    input  wire        clk,           // 100MHz System Clock
    input  wire        rst_n,         // Active-low asynchronous reset
    input  wire [3:0]  coin_pulse,    // [10, 5, 2, 1] coin detection strobe
    input  wire [3:0]  item_select,   // [D, C, B, A] user select buttons
    input  wire        cancel_req,    // Refund / Cancel button
    output reg  [3:0]  dispense_motor,// Actuator drive signals
    output reg         change_pulse,  // Greedy coin change solenoid pulse
    output reg  [7:0]  balance_out,   // 8-bit accumulator output to 7-seg
    output reg         alarm_insuf    // Insufficient funds alert flag
);

    // ---------------------------------------------------------------------
    // State Encoding (3-Bit Binary vs 5-Bit One-Hot)
    // ---------------------------------------------------------------------
    localparam [2:0] S_IDLE          = 3'b000,
                     S_ACCUMULATE    = 3'b001,
                     S_SELECT        = 3'b010,
                     S_DISPENSE      = 3'b011,
                     S_RETURN_CHANGE = 3'b100;

    // Sequential State Registers (D-Flip Flops)
    reg [2:0] state_reg, state_next;
    reg [7:0] acc_reg, acc_next;
    reg [7:0] chg_reg, chg_next;
    reg [7:0] item_price;

    // Item Price Look-Up Table (Combinational ROM)
    always @(*) begin
        case (item_select)
            4'b0001: item_price = 8'd15; // Soda:  Rs 15
            4'b0010: item_price = 8'd20; // Coffee:Rs 20
            4'b0100: item_price = 8'd10; // Snack: Rs 10
            4'b1000: item_price = 8'd5;  // Water: Rs 5
            default: item_price = 8'd0;
        endcase
    end

    // ---------------------------------------------------------------------
    // 1. Sequential Register Update (posedge clk or negedge rst_n)
    // ---------------------------------------------------------------------
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            state_reg <= S_IDLE;
            acc_reg   <= 8'd0;
            chg_reg   <= 8'd0;
        end else begin
            state_reg <= state_next;
            acc_reg   <= acc_next;
            chg_reg   <= chg_next;
        end
    end

    // ---------------------------------------------------------------------
    // 2. Next State Combinational Logic & Datapath
    // ---------------------------------------------------------------------
    always @(*) begin
        state_next  = state_reg;
        acc_next    = acc_reg;
        chg_next    = chg_reg;
        alarm_insuf = 1'b0;

        case (state_reg)
            S_IDLE: begin
                if (|coin_pulse) begin
                    state_next = S_ACCUMULATE;
                    // Add detected denomination
                    if (coin_pulse[0]) acc_next = acc_reg + 8'd1;
                    if (coin_pulse[1]) acc_next = acc_reg + 8'd2;
                    if (coin_pulse[2]) acc_next = acc_reg + 8'd5;
                    if (coin_pulse[3]) acc_next = acc_reg + 8'd10;
                end
            end

            S_ACCUMULATE: begin
                if (cancel_req) begin
                    chg_next   = acc_reg;
                    acc_next   = 8'd0;
                    state_next = S_RETURN_CHANGE;
                end else if (|coin_pulse) begin
                    if (coin_pulse[0]) acc_next = acc_reg + 8'd1;
                    if (coin_pulse[1]) acc_next = acc_reg + 8'd2;
                    if (coin_pulse[2]) acc_next = acc_reg + 8'd5;
                    if (coin_pulse[3]) acc_next = acc_reg + 8'd10;
                end else if (|item_select) begin
                    state_next = S_SELECT;
                end
            end

            S_SELECT: begin
                // Magnitude Comparator: acc_reg >= item_price
                if (acc_reg >= item_price) begin
                    chg_next   = acc_reg - item_price;
                    acc_next   = 8'd0;
                    state_next = S_DISPENSE;
                end else begin
                    alarm_insuf = 1'b1;
                    state_next  = S_ACCUMULATE;
                end
            end

            S_DISPENSE: begin
                if (chg_reg > 8'd0)
                    state_next = S_RETURN_CHANGE;
                else
                    state_next = S_IDLE;
            end

            S_RETURN_CHANGE: begin
                // Greedy change subtraction
                if (chg_reg >= 8'd10) chg_next = chg_reg - 8'd10;
                else if (chg_reg >= 8'd5) chg_next = chg_reg - 8'd5;
                else if (chg_reg >= 8'd2) chg_next = chg_reg - 8'd2;
                else if (chg_reg >= 8'd1) chg_next = chg_reg - 8'd1;

                if (chg_next == 8'd0)
                    state_next = S_IDLE;
            end
        endcase
    end

    // ---------------------------------------------------------------------
    // 3. Moore Output Logic (Depends purely on State Register)
    // ---------------------------------------------------------------------
    always @(*) begin
        dispense_motor = 4'b0000;
        change_pulse   = 1'b0;
        balance_out    = acc_reg;

        case (state_reg)
            S_DISPENSE: begin
                dispense_motor = item_select; // Pulse selected actuator
            end
            S_RETURN_CHANGE: begin
                change_pulse = (chg_reg > 8'd0);
            end
            default: ;
        endcase
    end

endmodule`;

  const vhdlCode = `-- =========================================================================
-- ENTITY: Vending_Machine_Controller (VHDL-93 Synthesizable)
-- Target: Xilinx Artix-7 FPGA (xc7a35t)
-- =========================================================================
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.NUMERIC_STD.ALL;

entity Vending_Machine_Controller is
    Port (
        clk            : in  STD_LOGIC;
        rst_n          : in  STD_LOGIC;
        coin_pulse     : in  STD_LOGIC_VECTOR(3 downto 0);
        item_select    : in  STD_LOGIC_VECTOR(3 downto 0);
        cancel_req     : in  STD_LOGIC;
        dispense_motor : out STD_LOGIC_VECTOR(3 downto 0);
        change_pulse   : out STD_LOGIC;
        balance_out    : out STD_LOGIC_VECTOR(7 downto 0);
        alarm_insuf    : out STD_LOGIC
    );
end Vending_Machine_Controller;

architecture Behavioral of Vending_Machine_Controller is
    type fsm_state_t is (S_IDLE, S_ACCUMULATE, S_SELECT, S_DISPENSE, S_RETURN_CHANGE);
    signal current_state, next_state : fsm_state_t;
    signal acc_reg, acc_next         : unsigned(7 downto 0);
    signal chg_reg, chg_next         : unsigned(7 downto 0);
    signal item_price                : unsigned(7 downto 0);
begin

    -- Synchronous Process
    process(clk, rst_n)
    begin
        if rst_n = '0' then
            current_state <= S_IDLE;
            acc_reg       <= (others => '0');
            chg_reg       <= (others => '0');
        elsif rising_edge(clk) then
            current_state <= next_state;
            acc_reg       <= acc_next;
            chg_reg       <= chg_next;
        end if;
    end process;

    -- Combinational Next-State and Datapath Process
    process(current_state, acc_reg, chg_reg, coin_pulse, item_select, cancel_req)
    begin
        next_state <= current_state;
        acc_next   <= acc_reg;
        chg_next   <= chg_reg;
        alarm_insuf<= '0';

        case current_state is
            when S_IDLE =>
                if coin_pulse /= "0000" then
                    next_state <= S_ACCUMULATE;
                end if;
            when S_ACCUMULATE =>
                if cancel_req = '1' then
                    chg_next   <= acc_reg;
                    acc_next   <= (others => '0');
                    next_state <= S_RETURN_CHANGE;
                elsif item_select /= "0000" then
                    next_state <= S_SELECT;
                end if;
            when S_SELECT =>
                if acc_reg >= item_price then
                    chg_next   <= acc_reg - item_price;
                    acc_next   <= (others => '0');
                    next_state <= S_DISPENSE;
                else
                    alarm_insuf <= '1';
                    next_state  <= S_ACCUMULATE;
                end if;
            when S_DISPENSE =>
                if chg_reg > 0 then
                    next_state <= S_RETURN_CHANGE;
                else
                    next_state <= S_IDLE;
                end if;
            when S_RETURN_CHANGE =>
                if chg_reg = 0 then
                    next_state <= S_IDLE;
                end if;
        end case;
    end process;

    balance_out <= std_logic_vector(acc_reg);
end Behavioral;`;

  const codeDisplay = document.getElementById('hdlCodeDisplay');
  const tabVerilog = document.getElementById('tabVerilog');
  const tabVhdl = document.getElementById('tabVhdl');
  const copyBtn = document.getElementById('btnCopyCode');

  if (!codeDisplay) return;

  function renderFormattedCode(codeStr, lang) {
    // Basic syntax coloring
    let escaped = codeStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    if (lang === 'verilog') {
      escaped = escaped
        .replace(/(\/\/.+)/g, '<span class="cmt">$1</span>')
        .replace(/\b(module|endmodule|input|output|wire|reg|parameter|localparam|always|posedge|negedge|begin|end|case|endcase|default|if|else)\b/g, '<span class="kw">$1</span>')
        .replace(/\b(\d+'[bhd]\w+|\d+)\b/g, '<span class="num">$1</span>');
    } else {
      escaped = escaped
        .replace(/(--.+)/g, '<span class="cmt">$1</span>')
        .replace(/\b(library|use|entity|is|port|in|out|end|architecture|of|begin|signal|type|process|if|then|elsif|else|case|when|others)\b/gi, '<span class="kw">$1</span>');
    }

    codeDisplay.innerHTML = escaped;
  }

  renderFormattedCode(verilogCode, 'verilog');

  if (tabVerilog && tabVhdl) {
    tabVerilog.addEventListener('click', () => {
      tabVerilog.classList.add('active');
      tabVhdl.classList.remove('active');
      renderFormattedCode(verilogCode, 'verilog');
    });

    tabVhdl.addEventListener('click', () => {
      tabVhdl.classList.add('active');
      tabVerilog.classList.remove('active');
      renderFormattedCode(vhdlCode, 'vhdl');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const isVerilog = tabVerilog.classList.contains('active');
      const textToCopy = isVerilog ? verilogCode : vhdlCode;
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.textContent = '✓ Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy RTL'; }, 2000);
      });
    });
  }
}

/* --------------------------------------------------------------------------
   7-SEGMENT DECODER PLAYGROUND
   -------------------------------------------------------------------------- */
function initSegmentPlayground() {
  const digitInput = document.getElementById('segPlaygroundInput');
  if (!digitInput) return;

  const segmentBits = {
    'segA_val': 0, 'segB_val': 1, 'segC_val': 2,
    'segD_val': 3, 'segE_val': 4, 'segF_val': 5, 'segG_val': 6
  };

  const segMap = {
    0: [1, 1, 1, 1, 1, 1, 0],
    1: [0, 1, 1, 0, 0, 0, 0],
    2: [1, 1, 0, 1, 1, 0, 1],
    3: [1, 1, 1, 1, 0, 0, 1],
    4: [0, 1, 1, 0, 0, 1, 1],
    5: [1, 0, 1, 1, 0, 1, 1],
    6: [1, 0, 1, 1, 1, 1, 1],
    7: [1, 1, 1, 0, 0, 0, 0],
    8: [1, 1, 1, 1, 1, 1, 1],
    9: [1, 1, 1, 1, 0, 1, 1]
  };

  function updatePlayground(val) {
    const digit = parseInt(val, 10);
    const bits = segMap[digit] || [0, 0, 0, 0, 0, 0, 0];
    const segNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];

    segNames.forEach((name, i) => {
      const poly = document.querySelector(`#playgroundSeg .seg-${name}`);
      const valSpan = document.getElementById(`segVal_${name}`);
      if (poly) {
        if (bits[i] === 1) poly.classList.add('on');
        else poly.classList.remove('on');
      }
      if (valSpan) {
        valSpan.textContent = bits[i];
        valSpan.style.color = bits[i] === 1 ? 'var(--cyan-neon)' : 'var(--text-muted)';
      }
    });

    const bcdValEl = document.getElementById('playgroundBcdVal');
    if (bcdValEl) {
      bcdValEl.textContent = digit.toString(2).padStart(4, '0');
    }
  }

  digitInput.addEventListener('input', (e) => {
    updatePlayground(e.target.value);
  });

  updatePlayground(5);
}

/* --------------------------------------------------------------------------
   K-MAP INTERACTIVITY
   -------------------------------------------------------------------------- */
function initKmapInteractivity() {
  const kmapCells = document.querySelectorAll('.kmap-table td');
  kmapCells.forEach(cell => {
    cell.addEventListener('mouseenter', () => {
      const loop = cell.getAttribute('data-loop');
      if (loop) {
        document.querySelectorAll(`.kmap-table td[data-loop="${loop}"]`).forEach(c => {
          c.style.boxShadow = '0 0 12px var(--cyan-neon)';
        });
      }
    });
    cell.addEventListener('mouseleave', () => {
      const loop = cell.getAttribute('data-loop');
      if (loop) {
        document.querySelectorAll(`.kmap-table td[data-loop="${loop}"]`).forEach(c => {
          c.style.boxShadow = '';
        });
      }
    });
  });
}

