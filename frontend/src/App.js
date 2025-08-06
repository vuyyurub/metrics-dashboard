import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend);

function App() {
  const backendUrl = process.env.REACT_APP_BACKEND_URL;

  const [cpuData, setCpuData] = useState([]);
  const [memoryData, setMemoryData] = useState([]);
  const [diskData, setDiskData] = useState([]);
  const [diskIoData, setDiskIoData] = useState([]);
  const [networkData, setNetworkData] = useState([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertStatus, setAlertStatus] = useState('');

  useEffect(() => {
    fetchAllMetrics();
    const interval = setInterval(fetchAllMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAllMetrics() {
    try {
      const [cpu, mem, disk, diskio, net] = await Promise.all([
        fetch(`${backendUrl}/metrics/cpu`).then(r => r.json()),
        fetch(`${backendUrl}/metrics/memory`).then(r => r.json()),
        fetch(`${backendUrl}/metrics/disk`).then(r => r.json()),
        fetch(`${backendUrl}/metrics/diskio`).then(r => r.json()),
        fetch(`${backendUrl}/metrics/network`).then(r => r.json()),
      ]);
      setCpuData(cpu);
      setMemoryData(mem);
      setDiskData(disk);
      setDiskIoData(diskio);
      setNetworkData(net);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  }

  async function sendAlert() {
    if (!alertMessage.trim()) {
      setAlertStatus('Alert message cannot be empty');
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: alertMessage }),
      });
      const data = await res.json();
      if (data.success) {
        setAlertStatus('Alert sent successfully! Check your email!');
        setAlertMessage('');
      } else {
        setAlertStatus('Failed to send alert');
      }
    } catch (err) {
      console.error('Error sending alert:', err);
      setAlertStatus('Error sending alert');
    }
  }

  function makeChartData(label, dataset, color) {
    return {
      labels: dataset.map(point => new Date(point.time).toLocaleTimeString()),
      datasets: [
        {
          label,
          data: dataset.map(point => Number(point.value).toFixed(2)),
          fill: false,
          borderColor: color,
          backgroundColor: color,
          tension: 0.3,
        },
      ],
    };
  }

  function makeDiskIoChartData(data) {
    return {
      labels: data.map(point => new Date(point.time).toLocaleTimeString()),
      datasets: [
        {
          label: 'Read (bytes)',
          data: data.map(point => Number(point.read)),
          fill: false,
          borderColor: '#4e79a7',
          backgroundColor: '#4e79a7',
          tension: 0.3,
        },
        {
          label: 'Write (bytes)',
          data: data.map(point => Number(point.write)),
          fill: false,
          borderColor: '#e15759',
          backgroundColor: '#e15759',
          tension: 0.3,
        },
      ],
    };
  }

  function makeNetworkChartData(data) {
    return {
      labels: data.map(point => new Date(point.time).toLocaleTimeString()),
      datasets: [
        {
          label: 'Network In (MB)',
          data: data.map(point => Number(point.in)),
          fill: false,
          borderColor: '#76b7b2',
          backgroundColor: '#76b7b2',
          tension: 0.3,
        },
        {
          label: 'Network Out (MB)',
          data: data.map(point => Number(point.out)),
          fill: false,
          borderColor: '#e15759',
          backgroundColor: '#e15759',
          tension: 0.3,
        },
      ],
    };
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>EC2 Monitoring Dashboard</h1>

      
      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>CPU Utilization (%)</h2>
          {cpuData.length === 0 ? <p>No data available</p> : <Line data={makeChartData('CPU %', cpuData, '#4e79a7')} />}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Memory Usage (%)</h2>
          {memoryData.length === 0 ? <p>No data available</p> : <Line data={makeChartData('Memory %', memoryData, '#f28e2b')} />}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Disk Usage (%)</h2>
          {diskData.length === 0 ? <p>No data available</p> : <Line data={makeChartData('Disk %', diskData, '#e15759')} />}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Disk I/O (bytes)</h2>
          {diskIoData.length === 0 ? (
            <p>No data available</p>
          ) : (
            <Line data={makeDiskIoChartData(diskIoData)} />
          )}
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Network In/Out (MB)</h2>
          {networkData.length === 0 ? (
            <p>No data available</p>
          ) : (
            <Line data={makeNetworkChartData(networkData)} />
          )}
        </div>
      </div>

      <div style={{ ...styles.card, maxWidth: '800px', margin: '40px auto' }}>
        <h2 style={styles.cardTitle}>Send Manual Alert</h2>
        <textarea
          rows={3}
          style={styles.textarea}
          value={alertMessage}
          onChange={e => setAlertMessage(e.target.value)}
          placeholder="Type alert message here"
        />
        <button style={styles.button} onClick={sendAlert}>Send Alert</button>
        <p style={styles.status}>{alertStatus}</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f4f6f8',
    padding: '20px',
    minHeight: '100vh',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '30px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: '#fff',
    padding: '20px',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    marginBottom: '15px',
    color: '#555',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    marginBottom: '10px',
    fontSize: '14px',
  },
  button: {
    backgroundColor: '#4e79a7',
    color: 'white',
    padding: '10px 15px',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  status: {
    marginTop: '10px',
    fontSize: '14px',
  },
};

export default App;