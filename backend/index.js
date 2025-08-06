require('dotenv').config();
const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const REGION = process.env.AWS_REGION;
const INSTANCE_ID = process.env.INSTANCE_ID;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

const cloudwatch = new AWS.CloudWatch({ region: REGION });
const sns = new AWS.SNS({ region: REGION });


async function getMetric(
  metricName,
  minutes = 30,
  stat = 'Average',
  unit = null,
  namespace = 'AWS/EC2',
  dimensions = [{ Name: 'InstanceId', Value: INSTANCE_ID }]
) {
  const endTime = new Date();
  const startTime = new Date(Date.now() - minutes * 60 * 1000);

  const params = {
    Namespace: namespace,
    MetricName: metricName,
    Dimensions: dimensions,
    StartTime: startTime,
    EndTime: endTime,
    Period: 60,
    Statistics: [stat],
  };

  if (unit) params.Unit = unit;

  console.log('CloudWatch getMetricStatistics params:', JSON.stringify(params, null, 2));
  
  const data = await cloudwatch.getMetricStatistics(params).promise();
  
  console.log('Received datapoints:', data.Datapoints.length);
  
  return data.Datapoints
    .sort((a, b) => a.Timestamp - b.Timestamp)
    .map(dp => ({ time: dp.Timestamp, value: dp[stat] }));
}


app.get('/metrics/cpu', async (req, res) => {
  try {
    res.json(await getMetric('CPUUtilization'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch CPU metrics' });
  }
});


app.get('/metrics/memory', async (req, res) => {
  try {
    const dimensions = [{ Name: 'InstanceId', Value: INSTANCE_ID }];
    res.json(await getMetric('mem_used_percent', 30, 'Average', 'Percent', 'CWAgent', dimensions));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch memory metrics' });
  }
});

app.get('/metrics/diskio', async (req, res) => {
  try {
    const dimensions = [{ Name: 'InstanceId', Value: INSTANCE_ID }];
    const [read, written] = await Promise.all([
      getMetric('diskio_read_bytes', 30, 'Sum', 'Bytes', 'CWAgent', dimensions),
      getMetric('diskio_write_bytes', 30, 'Sum', 'Bytes', 'CWAgent', dimensions)
    ]);
    
    
    const combinedData = read.map(readPoint => {
      const writePoint = written.find(w => w.time.getTime() === readPoint.time.getTime());
      return {
        time: readPoint.time,
        read: readPoint.value,
        write: writePoint ? writePoint.value : 0
      };
    });
    
    res.json(combinedData);
  } catch (err) {
    console.error('Disk I/O metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch disk I/O metrics', details: err.message });
  }
});


app.get('/metrics/disk', async (req, res) => {
  try {
    const dimensions = [
      { Name: 'InstanceId', Value: INSTANCE_ID },
      { Name: 'path', Value: '/' },
      { Name: 'device', Value: 'xvda1' },
      { Name: 'fstype', Value: 'xfs' }
    ];
    
    const data = await getMetric('disk_used_percent', 60, 'Average', 'Percent', 'CWAgent', dimensions);
    res.json(data);
  } catch (err) {
    console.error('Disk metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch disk metrics', details: err.message });
  }
});


app.get('/metrics/disk/all', async (req, res) => {
  try {
    const dimensions = [{ Name: 'InstanceId', Value: INSTANCE_ID }];
    res.json(await getMetric('disk_used_percent', 60, 'Average', 'Percent', 'CWAgent', dimensions));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch disk metrics' });
  }
});


app.get('/metrics/disk/root', async (req, res) => {
  try {
    const dimensions = [
      { Name: 'InstanceId', Value: INSTANCE_ID },
      { Name: 'path', Value: '/' },
      { Name: 'device', Value: 'xvda1' },
      { Name: 'fstype', Value: 'xfs' }
    ];
    
    const data = await getMetric('disk_used_percent', 60, 'Average', 'Percent', 'CWAgent', dimensions);
    res.json(data);
  } catch (err) {
    console.error('Root disk metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch root disk metrics' });
  }
});


app.get('/metrics/disk/debug', async (req, res) => {
  try {
    const params = {
      Namespace: 'CWAgent',
      MetricName: 'disk_used_percent'
    };
    
    const metrics = await cloudwatch.listMetrics(params).promise();
    

    const instanceMetrics = metrics.Metrics.filter(metric => 
      metric.Dimensions.some(dim => dim.Name === 'InstanceId' && dim.Value === INSTANCE_ID)
    );
    
    res.json({
      totalMetrics: metrics.Metrics.length,
      instanceMetrics: instanceMetrics.length,
      metrics: instanceMetrics
    });
  } catch (err) {
    console.error('Debug error:', err);
    res.status(500).json({ error: 'Debug failed' });
  }
});


app.get('/metrics/network', async (req, res) => {
  try {
    const inData = await getMetric('NetworkIn', 30, 'Average', 'Bytes');
    const outData = await getMetric('NetworkOut', 30, 'Average', 'Bytes');

    
    const combined = inData.map((point, idx) => ({
      time: point.time,
      in: (point.value / (1024 * 1024)).toFixed(2), 
      out: (outData[idx]?.value / (1024 * 1024)).toFixed(2) || 0,
    }));

    res.json(combined);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch network metrics' });
  }
});


const statsdDimensions = [{ Name: 'InstanceId', Value: INSTANCE_ID }];


app.get('/metrics/statsd/requests', async (req, res) => {
  try {
    const data = await getMetric('requests.count', 30, 'Sum', null, 'StatsD', statsdDimensions);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch requests count' });
  }
});


app.get('/metrics/statsd/latency', async (req, res) => {
  try {
    const data = await getMetric('latency.avg', 30, 'Average', 'Milliseconds', 'StatsD', statsdDimensions);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch latency' });
  }
});


app.get('/metrics/statsd/errors', async (req, res) => {
  try {
    const data = await getMetric('errors.count', 30, 'Sum', null, 'StatsD', statsdDimensions);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch errors count' });
  }
});


app.get('/metrics/statsd/memory', async (req, res) => {
  try {
    const data = await getMetric('memory.usage', 30, 'Average', 'Megabytes', 'StatsD', statsdDimensions);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch memory usage' });
  }
});


app.post('/alert', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    await sns.publish({
      TopicArn: SNS_TOPIC_ARN,
      Message: message,
      Subject: 'Manual EC2 Alert',
    }).promise();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send alert' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Express backend listening on port ${PORT}`);
});