import React from 'react'
import { render } from 'react-dom'
import { Experiment } from './components/Experiment';

const mainElement = document.createElement('div')
mainElement.setAttribute('id', 'root')
document.body.appendChild(mainElement)

const App = () => {
  return (
    <div>

      <Experiment/>

    </div>
  )
}

render(<App />, mainElement)
