import type { KubeAuthProxyLog } from "../../../main/kube-auth-proxy";

import "./cluster-status.scss"
import React from "react";
import { observer } from "mobx-react";
import { ipcRenderer } from "electron";
import { computed, observable } from "mobx";
import { clusterIpc } from "../../../common/cluster-ipc";
import { Icon } from "../icon";
import { Button } from "../button";
import { cssNames, IClassName } from "../../utils";
import { Cluster } from "../../../main/cluster";
import { ClusterId, clusterStore } from "../../../common/cluster-store";
import { CubeSpinner } from "../spinner";

interface Props {
  className?: IClassName;
  clusterId: ClusterId;
}

@observer
export class ClusterStatus extends React.Component<Props> {
  @observable authOutput: KubeAuthProxyLog[] = [];
  @observable isReconnecting = false;

  get cluster(): Cluster {
    return clusterStore.getById(this.props.clusterId);
  }

  @computed get hasErrors(): boolean {
    return this.authOutput.some(({ error }) => error) || !!this.cluster.failureReason;
  }

  async componentDidMount() {
    ipcRenderer.on(`kube-auth:${this.cluster.id}`, (evt, res: KubeAuthProxyLog) => {
      this.authOutput.push({
        data: res.data.trimRight(),
        error: res.error,
      });
    })
    if (!this.cluster.initialized || this.cluster.disconnected) {
      await this.refreshCluster();
    }
  }

  componentWillUnmount() {
    ipcRenderer.removeAllListeners(`kube-auth:${this.props.clusterId}`);
  }

  refreshCluster = async () => {
    await clusterIpc.activate.invokeFromRenderer(this.props.clusterId);
  }

  reconnect = async () => {
    this.isReconnecting = true;
    await this.refreshCluster();
    this.isReconnecting = false;
  }

  renderContent() {
    const { authOutput, cluster, hasErrors } = this;
    const failureReason = cluster.failureReason;
    if (!hasErrors || this.isReconnecting) {
      return (
        <>
          <CubeSpinner />
          <pre className="kube-auth-out">
            <p>{this.isReconnecting ? "Reconnecting..." : "Connecting..."}</p>
            {authOutput.map(({ data, error }, index) => {
              return <p key={index} className={cssNames({ error })}>{data}</p>
            })}
          </pre>
        </>
      );
    }
    return (
      <>
        <Icon material="cloud_off" className="error" />
        <h2>
          {cluster.preferences.clusterName}
        </h2>
        <pre className="kube-auth-out">
          {authOutput.map(({ data, error }, index) => {
            return <p key={index} className={cssNames({ error })}>{data}</p>
          })}
        </pre>
        {failureReason && (
          <div className="failure-reason error">{failureReason}</div>
        )}
        <Button
          primary
          label="Reconnect"
          className="box center"
          onClick={this.reconnect}
          waiting={this.isReconnecting}
        />
      </>
    );
  }

  render() {
    return (
      <div className={cssNames("ClusterStatus flex column gaps box center align-center justify-center", this.props.className)}>
        {this.renderContent()}
      </div>
    );
  }
}