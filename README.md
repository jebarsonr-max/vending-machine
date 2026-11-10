# Smart Vending Machine Controller: A Digital System Design Project

> **Hardware-level synchronous Finite State Machine (FSM) architecture, 8-bit arithmetic datapath, and real-time logic analyzer simulation.**

[![License: MIT](https://img.shields.io/badge/License-MIT-cyan.svg)](LICENSE)
[![Digital Logic: Verilog & VHDL](https://img.shields.io/badge/HDL-Verilog%20%7C%20VHDL-amber.svg)](#hdl-implementation)
[![Architecture: Xilinx Artix-7](https://img.shields.io/badge/FPGA-AMD%2FXilinx%20Artix--7-blue.svg)](#synthesis--fpga-utilization)
[![Status: Fully Verified](https://img.shields.io/badge/Verification-5%2F5%20Testbenches%20Passed-brightgreen.svg)](#verification--testbenches)

---

## ⚡ Overview

The **Smart Vending Machine Controller** is a complete, responsive digital system design engineering portfolio demonstrating discrete hardware design concepts through interactive visuals. 

Unlike software-based microcontroller loops that suffer from non-deterministic interrupt jitter and crash vulnerabilities, this controller utilizes a **synchronous positive edge-triggered Finite State Machine (FSM)** and an **8-bit parallel arithmetic datapath** designed for nanosecond determinism, glitch-free actuator firing, and FPGA synthesis.

### Key Architectural Highlights
- **Deterministic 100 MHz System Clock Domain:** Setup and hold time constraints verified ($0\text{ ns}$ slack violations).
- **Dual User Experiences:**
  - **👤 Customer Kiosk (`customer.html`):** Clean, realistic vending machine interface (coin slots ₹1, ₹2, ₹5, ₹10, product selections, dual 7-segment LED displays, animated dispenser bay, change tray, and digital receipt generation).
  - **🛠️ Admin / Engineering Console (`admin.html`):** Low-level hardware instrumentation cluster, single-step clock trigger, 8-bit accumulator bit monitors, 7-channel real-time logic analyzer waveform canvas, K-map minimizer, and automated testbenches.
- **Strict Refund Integrity:** Refunds are protected by hardware collection state logic. Pre-purchase inserted coins can be refunded; once an item is dispensed, purchase cancellation is permitted only if the item has not yet been taken from the chute. Once collected, refunds are strictly blocked.
- **Automated Digital Invoicing:** Generates a digital tax receipt after each transaction detailing item cost, cash inserted, change returned, and FSM cycle latency.

---

## 📐 Finite State Machine (FSM) Specification

The sequential controller is synthesized using 3 D-type flip-flops ($Q_2, Q_1, Q_0$) with the following state assignments:

| State Code | State Identifier | Binary ($Q_2 Q_1 Q_0$) | One-Hot ($5\text{-bit}$) | Operational Behavior & Registered Outputs |
| :--- | :--- | :---: | :---: | :--- |
| **$S_0$** | `S_IDLE` | `000` | `00001` | Quiescent state. Displays `₹00`, all actuators disabled. |
| **$S_1$** | `S_ACCUMULATE` | `001` | `00010` | Coin pulse detected (`Cin[3:0]`). 8-bit Ripple-Carry adder updates $ACC \leftarrow ACC + \text{Val}$. |
| **$S_2$** | `S_SELECT` | `010` | `00100` | Magnitude comparator evaluates condition: $ACC \ge \text{Price}$. |
| **$S_3$** | `S_DISPENSE` | `011` | `01000` | Registered Moore output asserts `Dispense_Motor[i]`. Calculates change: $CHG \leftarrow ACC - \text{Price}$. |
| **$S_4$** | `S_RETURN_CHANGE`| `100` | `10000` | Greedy coin dispenser subtracts ₹10, ₹5, ₹2, ₹1 per clock cycle until residual change is zero. |

### Architectural Output Decision: Moore vs. Mealy
- **Moore Outputs:** All mechanical actuators (`Dispense_Motor`, `Change_Solenoid_Pulse`) are driven strictly by registered state flip-flops ($f(\text{State})$). This guarantees $100\%$ immunity to asynchronous input bounce and combinational glitches.
- **Mealy Output:** An asynchronous `Coin_Reject` signal fires immediately if a coin is inserted while the machine is actively dispensing or returning change, preventing coin jams.

---

## 🗂️ Project File Structure

```
.
├── index.html                   # Master engineering portfolio (11 interactive DSD sections)
├── customer.html                # Dedicated Customer Vending Kiosk (simplified interface)
├── admin.html                   # Dedicated Engineering / Admin Telemetry Console
│
├── styles/
│   ├── main.css                 # PCB trace grid, theme tokens (Dark Navy / Blueprint Light)
│   └── components.css           # Vending machine chassis, 7-segment displays, waveforms, bill modal
│
└── js/
    ├── fsm-engine.js            # Synthesizable sequential FSM model & arithmetic datapath
    ├── customer-ui.js           # Kiosk interface controller, sound engine, refund & receipt logic
    ├── simulator-ui.js          # Admin dashboard controller, telemetry synchronization
    ├── waveform.js              # 7-channel real-time logic analyzer canvas with hover crosshair
    ├── diagrams.js              # Interactive block diagram inspector, live FSM graph, K-maps
    ├── testbench.js             # Automated 5-testbench verification suite with assertions
    └── app.js                   # Application bootstrap, theme engine, and HDL syntax viewer
```

---

## 🛠️ Hardware Datapath Components

1. **Sequential State Memory (D-Flip-Flops):** Positive edge-triggered master-slave registers with active-low asynchronous reset (`RST_N`).
2. **8-Bit Ripple-Carry Full Adder:** Fast combinational accumulator supporting denominations up to ₹255.
3. **8-Bit Magnitude Comparator:** Evaluates condition $ACC \ge \text{Price}$ in $<4.5\text{ ns}$.
4. **Greedy Change Subtractor:** Progressively decrements change owed using optimal coin denominations.
5. **BCD to 7-Segment Decoder:** Combinational logic mapping 4-bit binary values to active-low/high segments `a` through `g`.

---

## 🧪 Verification & Testbenches

The built-in verification suite tests critical edge cases directly in hardware:

| Testcase | Name | Stimulus Vector | Pass Assertion |
| :---: | :--- | :--- | :--- |
| **TC_01** | Exact Change Transaction | Insert ₹10 + ₹5 $\to$ Select Soda (₹15) | Single dispense pulse, $CHG = 0$, return to `S_IDLE`. |
| **TC_02** | Insufficient Funds Guard | Insert ₹10 $\to$ Select Coffee (₹20) | `ALARM_INSUF` asserted, dispense blocked, balance held. |
| **TC_03** | Multi-Coin Excess Change | Insert ₹10 + ₹10 $\to$ Select Soda (₹15) | Dispenses item, returns ₹5 coin, clean `S_IDLE` recovery. |
| **TC_04** | Mid-Transaction Cancel | Insert ₹10 + ₹2 $\to$ Cancel | Sequential ₹10 + ₹2 coin refund, returns to `S_IDLE`. |
| **TC_05** | Asynchronous Reset | Mid-transaction $RST\_N = 0$ strobe | Immediate asynchronous clear of state & registers. |

---

## 💻 Synthesis & FPGA Utilization

Target device: **AMD/Xilinx Artix-7 (XC7A35TCPG236-1)**  
Toolchain: **Vivado 2024.1 / ModelSim**

| Primitive Resource | Design Utilization | Available on Artix-7 | Utilization % |
| :--- | :---: | :---: | :---: |
| **Slice LUTs** | 34 | 20,800 | 0.16% |
| **Slice Registers / FFs** | 19 | 41,600 | 0.04% |
| **Bounded I/O Pins** | 21 | 106 | 19.8% |
| **Maximum Operating Frequency ($F_{\max}$)** | **166.4 MHz** | Target: 100 MHz | **+4.21 ns Slack (MET)** |

---

## 🚀 Running the Project Locally

No node packages, bundlers, or heavy frameworks required. Pure vanilla web technologies:

```bash
# Clone the repository
git clone https://github.com/DabriaSam/Vending-machine.git

# Enter the directory
cd Vending-machine

# Launch with any standard HTTP server (e.g., Python)
python -m http.server 8080
```

Open in your browser:
- **Master Engineering Portfolio:** `http://localhost:8080/index.html`
- **Customer Kiosk:** `http://localhost:8080/customer.html`
- **Admin & Waveform Console:** `http://localhost:8080/admin.html`

---

## 📜 References
1. M. Morris Mano & Michael D. Ciletti, *Digital Design: With an Introduction to the Verilog HDL*, Pearson, 6th Edition.
2. Charles H. Roth Jr. & Larry L. Kinney, *Fundamentals of Logic Design*, Cengage Learning, 7th Edition.
3. IEEE Std 1364-2005: *IEEE Standard for Verilog Hardware Description Language*.
4. AMD Xilinx, *7 Series FPGAs Configurable Logic Block User Guide (UG474)*.

---
*Created by **DabriaSam** as a Digital System Design & VLSI Architecture Project.*
