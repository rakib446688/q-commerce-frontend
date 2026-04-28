import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unexpected error." };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="section">
            <h2 className="h2">Something went wrong</h2>
            <p className="p">{this.state.message}</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
