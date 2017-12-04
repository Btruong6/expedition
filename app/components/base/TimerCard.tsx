import * as React from 'react'
import MultiTouchTrigger from './MultiTouchTrigger'
import {CardThemeType} from '../../reducers/StateTypes'
import {RemotePlayState} from '../../reducers/StateTypes'

interface TimerCardProps extends React.Props<any> {
  numPlayers: number;
  secondaryText?: string;
  tertiaryText?: string;
  roundTimeTotalMillis: number;
  theme: CardThemeType;
  remotePlayState: RemotePlayState;
  onTimerStop: (elapsedMillis: number) => any;
}

export default class TimerCard extends React.Component<TimerCardProps, {}> {
  interval: any;
  state: {startTimeMillis: number, timeRemaining: number};

  constructor(props: TimerCardProps) {
    super(props)
    this.state = {startTimeMillis: Date.now(), timeRemaining: this.props.roundTimeTotalMillis};
    this.interval = setInterval(() => {
      this.setState({timeRemaining: this.props.roundTimeTotalMillis - (Date.now() - this.state.startTimeMillis)});
    }, 100);
  }

  onTouchChange(numFingers: number) {
    if (!this.interval) {
      return;
    }

    if (numFingers === this.props.numPlayers) {
      clearInterval(this.interval);
      this.interval = null;
      this.props.onTimerStop(Date.now() - this.state.startTimeMillis);
    }
  }

  componentWillUnmount() {
    // Remote play may unmount this component without a touch event.
    // This makes sure our timer eventually stops.
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  render() {
    const timeRemainingSec = this.state.timeRemaining / 1000;
    let formattedTimer: string;
    if (timeRemainingSec < 10 && timeRemainingSec > 0) {
      formattedTimer = timeRemainingSec.toFixed(1);
    }
    else {
      formattedTimer = timeRemainingSec.toFixed(0);
    }
    return (
      <div className={'base_timer_card ' + (this.props.theme || 'LIGHT')}>
        <div className="value">{formattedTimer}s</div>
        {this.props.secondaryText && <div className="secondary">{this.props.secondaryText}</div>}
        {this.props.tertiaryText && <div className="tertiary">{this.props.tertiaryText}</div>}
        <MultiTouchTrigger onTouchChange={this.onTouchChange.bind(this)} />
      </div>
    );
  }
}
