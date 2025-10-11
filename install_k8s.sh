#!/bin/bash
set -e

# ========== 基本设置 ==========
echo "[Step 1] 更新系统..."
sudo apt update -y && sudo apt upgrade -y

echo "[Step 2] 禁用 swap..."
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# ========== 内核参数设置 ==========
echo "[Step 3] 配置内核模块与网络转发..."
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF

sudo modprobe overlay
sudo modprobe br_netfilter

cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF

sudo sysctl --system

# ========== 安装 containerd ==========
echo "[Step 4] 安装 containerd..."
sudo apt install -y containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd
sudo systemctl enable containerd

# ========== 安装 Kubernetes ==========
echo "[Step 5] 添加 Kubernetes 源..."
sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://pkgs.k8s.io/core:/stable:/v1.31/deb/Release.key
echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.31/deb/ /" | sudo tee /etc/apt/sources.list.d/kubernetes.list

echo "[Step 6] 安装 kubeadm、kubelet、kubectl..."
sudo apt update
sudo apt install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl

# ========== 初始化集群（仅主节点执行） ==========
read -p "是否初始化为 master 节点？(y/n): " IS_MASTER
if [[ "$IS_MASTER" == "y" || "$IS_MASTER" == "Y" ]]; then
  echo "[Step 7] 初始化 Kubernetes master..."
  sudo kubeadm init --pod-network-cidr=10.244.0.0/16

  echo "[Step 8] 配置 kubectl..."
  mkdir -p $HOME/.kube
  sudo cp -i /etc/kubernetes/admin.conf $HOME/.kube/config
  sudo chown $(id -u):$(id -g) $HOME/.kube/config

  echo "[Step 9] 安装 Flannel 网络插件..."
  kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

  echo
  echo "✅ Master 节点安装完成！"
  echo "请复制下面的 join 命令到 Worker 节点执行以加入集群："
  kubeadm token create --print-join-command
else
  echo
  echo "请在 Master 上执行 'kubeadm token create --print-join-command' 复制 join 命令，在本节点上运行即可。"
fi

