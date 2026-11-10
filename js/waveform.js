/**
 * SMART VENDING MACHINE CONTROLLER - DIGITAL SYSTEM DESIGN
 * js/waveform.js: Real-Time Multi-Channel Digital Logic Analyzer Canvas
 *
 * Visualizes synchronous signal transitions at clock edges:
 * CLK, RST_N, COIN_IN, STATE[2:0], DISPENSE_EN, CHG_RETURN, ACCUMULATOR[7:0]
 */

class LogicWaveformAnalyzer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Channels configuration
    this.channels = [
      { name: 'CLK', type: 'digital', color: '#ffb700', height: 26 },
      { name: 'RST_N', type: 'digital', color: '#00ff88', height: 24 },
      { name: 'COIN_IN', type: 'digital', color: '#00f0ff', height: 24 },
      { name: 'STATE[2:0]', type: 'bus', color: '#b537f2', height: 28 },
      { name: 'ACC[7:0]', type: 'bus', color: '#00f0ff', height: 28 },
      { name: 'DISPENSE', type: 'digital', color: '#00ff88', height: 24 },
      { name: 'CHG_PULSE', type: 'digital', color: '#ffb700', height: 24 }
    ];

    // History buffer of samples
    this.history = [];
    this.maxSamples = 60;
    this.timeIndex = 0;

    // Canvas scaling & sizing
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Interactive Crosshair & Inspection Cursor
    this.hoverIndex = null;
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const labelWidth = 90;
      const waveAreaWidth = this.displayWidth - labelWidth - 10;
      if (mouseX >= labelWidth && mouseX <= this.displayWidth - 10) {
        const sampleWidth = waveAreaWidth / (this.maxSamples - 1);
        const idx = Math.round((mouseX - labelWidth) / sampleWidth);
        if (idx >= 0 && idx < this.history.length) {
          this.hoverIndex = idx;
        } else {
          this.hoverIndex = null;
        }
      } else {
        this.hoverIndex = null;
      }
      this.render();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverIndex = null;
      this.render();
    });

    // Initialize with default idle signals
    for (let i = 0; i < 20; i++) {
      this.recordSample({
        clockCycle: i,
        clockState: i % 2,
        resetN: true,
        inputCoinValid: false,
        currentStateName: 'S_IDLE',
        accumulator: 0,
        dispenseEnable: false,
        coinReturnPulse: false
      });
    }
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
    this.render();
  }

  recordSample(telemetry) {
    this.timeIndex++;
    this.history.push({
      time: this.timeIndex,
      cycle: telemetry.clockCycle,
      clk: telemetry.clockState,
      rst_n: telemetry.resetN ? 1 : 0,
      coin: telemetry.inputCoinValid ? 1 : 0,
      state: telemetry.currentStateName.replace('S_', ''),
      acc: `₹${telemetry.accumulator}`,
      disp: telemetry.dispenseEnable ? 1 : 0,
      chg: telemetry.coinReturnPulse ? 1 : 0
    });

    if (this.history.length > this.maxSamples) {
      this.history.shift();
    }

    this.render();
  }

  clear() {
    this.history = [];
    this.timeIndex = 0;
    this.render();
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const w = this.displayWidth;
    const h = this.displayHeight;

    // Clear background
    ctx.fillStyle = '#050813';
    ctx.fillRect(0, 0, w, h);

    const labelWidth = 90;
    const waveAreaWidth = w - labelWidth - 10;
    const numSamples = this.history.length;
    const sampleWidth = numSamples > 1 ? waveAreaWidth / (this.maxSamples - 1) : 10;

    // Draw background timing grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < this.maxSamples; i++) {
      const x = labelWidth + i * sampleWidth;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h - 20);
    }
    ctx.stroke();

    // Time ticker row at bottom
    ctx.fillStyle = '#485d7c';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < this.maxSamples; i += 5) {
      const x = labelWidth + i * sampleWidth;
      ctx.fillText(`T${i}`, x, h - 6);
    }

    let currentY = 14;

    // Render each channel
    this.channels.forEach((ch) => {
      // Channel Label
      ctx.fillStyle = ch.color;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(ch.name, 10, currentY + ch.height * 0.65);

      // Channel Baseline
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(labelWidth, currentY + ch.height);
      ctx.lineTo(w, currentY + ch.height);
      ctx.stroke();

      const highY = currentY + 4;
      const lowY = currentY + ch.height - 4;

      if (ch.type === 'digital') {
        ctx.strokeStyle = ch.color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        let prevVal = null;
        for (let i = 0; i < this.history.length; i++) {
          const sample = this.history[i];
          const x = labelWidth + i * sampleWidth;
          let val = 0;

          if (ch.name === 'CLK') val = sample.clk;
          else if (ch.name === 'RST_N') val = sample.rst_n;
          else if (ch.name === 'COIN_IN') val = sample.coin;
          else if (ch.name === 'DISPENSE') val = sample.disp;
          else if (ch.name === 'CHG_PULSE') val = sample.chg;

          const targetY = val === 1 ? highY : lowY;

          if (i === 0) {
            ctx.moveTo(x, targetY);
          } else {
            if (prevVal !== val) {
              // Clock/Signal Edge
              ctx.lineTo(x, prevVal === 1 ? highY : lowY);
              ctx.lineTo(x, targetY);
            } else {
              ctx.lineTo(x, targetY);
            }
          }
          prevVal = val;
        }
        ctx.stroke();

      } else if (ch.type === 'bus') {
        // Hex / Encoded Bus with hexagonal crossover transitions
        for (let i = 0; i < this.history.length; i++) {
          const sample = this.history[i];
          const x = labelWidth + i * sampleWidth;
          const nextX = x + sampleWidth;
          let valText = ch.name.includes('STATE') ? sample.state : sample.acc;

          const prevSample = i > 0 ? this.history[i - 1] : null;
          const isTransition = prevSample && (
            (ch.name.includes('STATE') && prevSample.state !== sample.state) ||
            (ch.name.includes('ACC') && prevSample.acc !== sample.acc)
          );

          ctx.strokeStyle = ch.color;
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          if (isTransition) {
            // Bus crossover lines
            ctx.moveTo(x - 4, highY);
            ctx.lineTo(x + 4, lowY);
            ctx.moveTo(x - 4, lowY);
            ctx.lineTo(x + 4, highY);
          } else {
            ctx.moveTo(x, highY);
            ctx.lineTo(nextX, highY);
            ctx.moveTo(x, lowY);
            ctx.lineTo(nextX, lowY);
          }
          ctx.stroke();

          // Render Bus text if segment is wide enough or at state changes
          if (i % 4 === 0 || isTransition) {
            ctx.fillStyle = ch.color;
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(valText, x + 3, currentY + ch.height * 0.65);
          }
        }
      }

      currentY += ch.height + 8;
    });

    // Draw Interactive Crosshair & Inspection Tooltip
    if (this.hoverIndex !== null && this.history[this.hoverIndex]) {
      const sample = this.history[this.hoverIndex];
      const sampleX = labelWidth + this.hoverIndex * sampleWidth;

      // Vertical cursor line
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(sampleX, 4);
      ctx.lineTo(sampleX, h - 22);
      ctx.stroke();
      ctx.setLineDash([]);

      // Floating Inspection HUD Badge
      const text = `T${sample.time} | CLK:${sample.clk} | RST:${sample.rst_n} | STATE:${sample.state} | ACC:${sample.acc} | DISP:${sample.disp} | CHG:${sample.chg}`;
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      const textMetrics = ctx.measureText(text);
      const badgeW = textMetrics.width + 16;
      const badgeH = 20;
      let badgeX = sampleX - badgeW / 2;
      if (badgeX < labelWidth + 4) badgeX = labelWidth + 4;
      if (badgeX + badgeW > w - 10) badgeX = w - badgeW - 10;
      const badgeY = 6;

      ctx.fillStyle = 'rgba(10, 15, 31, 0.95)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4) : ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.textAlign = 'left';
      ctx.fillText(text, badgeX + 8, badgeY + 14);
    }
  }
}

window.LogicWaveformAnalyzer = LogicWaveformAnalyzer;

