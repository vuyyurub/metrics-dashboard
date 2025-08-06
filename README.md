# AWS EC2 Performance Dashboard

**Live Dashboard:** [metrics-dashboard-two.vercel.app](https://metrics-dashboard-two.vercel.app)

## Key Features

### Metrics Observed on EC2 Instance
- CPU Utilization (%)
- Memory Usage (%)
- Disk I/O Operations
- Network Throughput

### Automated Alert System
- **Threshold-based alerts** via AWS Lambda
- Email notifications when CPU usage exceeds configurable limits
- Integrated with Amazon SNS for alert distribution

## Technical Components
- **Data Collection**: AWS CloudWatch metrics
- **Alert Engine**: Lambda functions triggered by CloudWatch Alarms
- **Visualization**: React with Chart.js
- **Backend**: Node.js with AWS SDK
