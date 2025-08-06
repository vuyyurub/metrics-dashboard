const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch({ region: process.env.APP_REGION });
const sns = new AWS.SNS({ region: process.env.APP_REGION });

const INSTANCE_ID = process.env.INSTANCE_ID;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

exports.handler = async () => {
  const endTime = new Date();
  const startTime = new Date(Date.now() - 60 * 60 * 1000); 

  const params = {
    Namespace: 'AWS/EC2',
    MetricName: 'CPUUtilization',
    Dimensions: [{ Name: 'InstanceId', Value: INSTANCE_ID }],
    StartTime: startTime,
    EndTime: endTime,
    Period: 300, 
    Statistics: ['Average'],
  };

  try {
    const data = await cloudwatch.getMetricStatistics(params).promise();
    const datapoints = data.Datapoints || [];

    if (datapoints.length === 0) {
      console.log('No data points found.');
      return;
    }

    const avgCPU = datapoints.reduce((sum, dp) => sum + dp.Average, 0) / datapoints.length;
    console.log(`Average CPU Utilization over last hour: ${avgCPU.toFixed(2)}%`);

    const threshold = 80;
    if (avgCPU > threshold) {
      const message = `Alert! CPU Utilization is high on instance ${INSTANCE_ID}: ${avgCPU.toFixed(2)}%`;

      await sns.publish({
        TopicArn: SNS_TOPIC_ARN,
        Message: message,
        Subject: 'EC2 CPU Utilization Alert',
      }).promise();

      console.log('Alert sent.');
    } else {
      console.log('CPU utilization is normal.');
    }
  } catch (err) {
    console.error('Error fetching metrics or sending alert:', err);
  }
};
