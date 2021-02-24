import React, { MouseEvent } from 'react'
import { Chart } from "react-charts"
import styles from './Experiment.scss'

function rgbToHex ({ r, g, b }: {r, g, b: number}): string {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
}

function hexToRgb (hex: string): number[3] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

const STATE_COLORS = [
  { code: 'normal', name: 'Восприимчивые', color: hexToRgb('#4eadee') },
  { code: 'incub', name: 'В инкубационном периоде', color: hexToRgb('#ee2c24') },
  { code: 'infect', name: 'Больные', color: hexToRgb('#7c1f1d') },
  { code: 'healed', name: 'Выздоровевшие', color: hexToRgb('#3bee5d') },
  { code: 'dead', name: 'Погибшие', color: hexToRgb('#000000') },
  { code: 'mask', name: 'В масках', color: hexToRgb('#3f7db2') },
]

interface ExperimentProps {}
interface ExperimentState {
  incFrom: number;
  incTo: number;
  infectFrom: number;
  infectTo: number;
  days: number;
  numInfect: number;
  numHealed: number;
  numDead: number;
  chartData: number[number[2]],
}

const rand = (from, to: number): number => from + Math.random() * (to - from)

export class Experiment extends React.Component<ExperimentProps, Partial<ExperimentState>> {
  private readonly canvasEl: React.RefObject<HTMLCanvasElement>;
  private imgData: ImageData;
  private buffer: Uint8ClampedArray
  private randField: Uint8ClampedArray
  private steps: Uint8ClampedArray
  private tickCtx: number;

  constructor (props: ExperimentProps) {
    super(props)
    this.canvasEl = React.createRef()
    this.state = {
      incFrom: 2,
      incTo: 14,
      infectFrom: 7,
      infectTo: 22,
      days: 0,
      numInfect: 0,
      numHealed: 0,
      numDead: 0,
      chartData: [[0, 0]],
    }
  }

  componentDidMount (): void {
    if (this.canvasEl.current) {
      const ctx: CanvasRenderingContext2D = this.canvasEl.current.getContext('2d')
      const { width, height } = this.canvasEl.current

      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, width, height)

      this.imgData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height)
      this.buffer = new Uint8ClampedArray(width * height)
      this.steps = new Uint8ClampedArray(width * height)
      this.randField = new Uint8ClampedArray(width * height)

      for (let i = 0; i < this.randField.length; ++i) {
        this.randField[i] = Math.random()
      }

      this.tickCtx = setInterval(this.tick.bind(this), 100)
    }
  }

  componentWillUnmount (): void {
    clearInterval(this.tickCtx)
  }

  tick (): void {
    const { days, incTo, incFrom, infectFrom, infectTo, chartData } = this.state
    const { width, height } = this.canvasEl.current
    const ways: (number | null)[] = [
      -1, 1,
      -height, height,
    ]

    let numInfect = 0
    let numHealed = 0
    let numDead = 0

    const temp = new Uint8ClampedArray(this.buffer)
    const { buffer, steps } = this
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const addr = y * height + x
        if (temp[addr] === 1) {
          steps[addr] += 1
          if (steps[addr] > Math.ceil(incFrom + this.randField[addr] * (incTo - incFrom))) {
            buffer[addr] = 2
            steps[addr] = 0
          }
        }
        if (temp[addr] === 2) {
          steps[addr] += 1
          if (steps[addr] > Math.ceil(infectFrom + this.randField[addr] * (infectTo - infectFrom))) {
            if (Math.random() * 100 > 3) {
              buffer[addr] = 3
            } else {
              buffer[addr] = 4
            }
          }
        }
        if (temp[addr] === 0) {
          const inf = ways.reduce((s, w) => s + (temp[addr + w] === 1) ? 1 : 0, 0)
          if (inf > 0 && rand(0, 100) < 25) {
            buffer[addr] = 1
          }
        }

        if (temp[addr] === 1 || temp[addr] === 2) numInfect += 1
        if (temp[addr] === 3) numHealed += 1
        if (temp[addr] === 4) numDead += 1
      }
    }

    this.setState({ numInfect, numHealed, numDead })

    if (numInfect > 0) {
      this.setState({ days: days + 1 })
    }

    if (numInfect > 0 && days % 6 === 0) {
      this.setState({ chartData: chartData.concat([[days, numInfect]]) })
    }

    /*
      |-----|-----|-----|
      |     |     |     |
      |-----|-----|-----|
      |     |  X  |     |
      |-----|-----|-----|
      |     |     |     |
      |-----|-----|-----|
     */

    this.paint()
  }

  paint () {
    if (!this.canvasEl.current) return

    const ctx: CanvasRenderingContext2D = this.canvasEl.current.getContext('2d')
    const { width, height } = this.canvasEl.current

    const data = this.imgData.data
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const addr = (y * height + x)
        const { color } = STATE_COLORS[this.buffer[addr]]
        data[addr * 4] = color.r
        data[addr * 4 + 1] = color.g
        data[addr * 4 + 2] = color.b
        data[addr * 4 + 3] = 255
      }
    }

    ctx.putImageData(this.imgData, 0, 0)
  }

  mousePick (ev: MouseEvent) {
    if (ev.buttons !== 1) return
    var rect = ev.target.getBoundingClientRect()
    var x = ev.clientX - rect.left
    var y = ev.clientY - rect.top

    const { height } = this.canvasEl.current
    const addr = Math.floor(y / 3) * height + Math.floor(x / 3)
    this.buffer[addr] = 1
    this.paint()
  }

  maskOn (percent: number) {
    for (let i = 0; i < this.buffer.length; i++) {
      if (Math.random() * 100 < percent && this.buffer[i] === 0) {
        this.buffer[i] = 5
      }
    }
  }

  startPan () {
    const { height, width } = this.canvasEl.current
    for (let i = 0; i < 5; i++) {
      const x = 10 + Math.ceil(Math.random() * (width - 20))
      const y = 10 + Math.ceil(Math.random() * (height - 20))
      this.buffer[y * width + x] = 1
    }
  }

  reset () {
    for (let i = 0; i < this.buffer.length; i++) {
        this.buffer[i] = 0
    }
    this.setState({
      days: 0,
      numInfect: 0,
      numHealed: 0,
      numDead: 0,
      chartData: [[0, 0]],
    })
    for (let i = 0; i < this.randField.length; ++i) {
      this.randField[i] = Math.random()
    }
    for (let i = 0; i < this.steps.length; ++i) {
      this.steps[i] = 0
    }
  }

  render () {
    const { days, incFrom, incTo, infectFrom, infectTo, numInfect, numHealed, numDead, chartData } = this.state

    return <div>

      <ul className={styles.legend}>
        {STATE_COLORS.map(a => <li key={a.code}><span style={{ backgroundColor: rgbToHex(a.color) }}/>{a.name}</li>)}

        <li>
          Инкубационный период от
          <input type="number" min={0} max={20} value={incFrom} onChange={ev => this.setState({ incFrom: parseInt(ev.target.value) })}/>до
          <input type="number" min={0} max={20} value={incTo} onChange={ev => this.setState({ incTo: parseInt(ev.target.value) })}/> дней
        </li>
        <li>
          Продолжительность болезни от
          <input type="number" min={0} max={40} value={infectFrom} onChange={ev => this.setState({ infectFrom: parseInt(ev.target.value) })}/>до
          <input type="number" min={0} max={40} value={infectTo} onChange={ev => this.setState({ infectTo: parseInt(ev.target.value) })}/> дней
        </li>

        <li>
          Прошло дней: {days}
        </li>

        <li>
          Зараженные: {numInfect}
        </li>
        <li>
          Выздоровевшие: {numHealed}
        </li>
        <li>
          Умершие: {numDead}
        </li>
      </ul>

      <canvas ref={this.canvasEl}
        width={200}
        height={200}
        style={{
          width: '600px',
          height: '600px',
          imageRendering: 'pixelated',
        }}
        onMouseDown={this.mousePick.bind(this)}
        onMouseMove={this.mousePick.bind(this)}
      />

      <div className={styles.chart}>
        <Chart data={[
          {
            label: 'Зараженные',
            data: chartData,
          },
        ]} series={{ showPoints: false }} axes={[
          { type: 'linear', position: 'bottom', primary: true },
          { type: 'linear', position: 'left' },
        ]} tooltip />
      </div>

      <p/>

      <div className={styles.buttons}>
        <button onClick={this.startPan.bind(this)}>Начать пандемию</button>
        <button onClick={this.maskOn.bind(this, 20)}>Надеть маски на 20% людей</button>
        <button onClick={this.maskOn.bind(this, 30)}>Надеть маски на 30% людей</button>
        <button onClick={this.maskOn.bind(this, 40)}>Надеть маски на 40% людей</button>
        <button onClick={this.reset.bind(this)}>Сбросить</button>
      </div>

    </div>
  }
}
