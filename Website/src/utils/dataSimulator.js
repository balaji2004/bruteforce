// Data Simulator for testing Firebase storage
// This simulates sensor data being written to Firebase

import { database, ref, set, update, get } from '@/lib/firebase';

/**
 * Simulates sensor data being sent from hardware to Firebase
 * This would normally come from your LoRa/WiFi sensors
 */
export class DataSimulator {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Generates realistic sensor readings with some variation
   */
  generateSensorData(baseData, isGateway = false) {
    const variation = () => (Math.random() - 0.5) * 2;
    
    return {
      temperature: +(baseData.temperature + variation()).toFixed(2),
      pressure: +(baseData.pressure + variation() * 2).toFixed(2),
      altitude: +(baseData.altitude + variation() * 0.5).toFixed(2),
      humidity: isGateway || baseData.humidity !== null ? +(baseData.humidity + variation() * 3).toFixed(2) : null,
      rssi: isGateway ? null : Math.floor((baseData.rssi || -70) + variation() * 5),
      status: 'online',
      lastUpdate: Math.floor(Date.now() / 1000).toString()  // Unix timestamp in seconds as string
    };
  }

  /**
   * Writes sensor data to Firebase (realtime + history)
   * Uses new structure: history with auto-generated keys
   */
  async writeSensorData(nodeId, sensorData) {
    try {
      // Update realtime data (overwrites previous values)
      await update(ref(database, `nodes/${nodeId}/realtime`), sensorData);

      // Store in history (appends with auto-generated key)
      const historyRef = ref(database, `nodes/${nodeId}/history`);
      const newHistoryRef = ref(database, `nodes/${nodeId}/history/${Date.now()}`);
      
      const historyData = {
        temperature: sensorData.temperature,
        pressure: sensorData.pressure,
        altitude: sensorData.altitude,
        humidity: sensorData.humidity,
        rainfall: sensorData.rssi !== null ? Math.random() > 0.9 ? +(Math.random() * 5).toFixed(1) : 0 : null,
        rssi: sensorData.rssi,
        timestamp: sensorData.lastUpdate
      };

      await set(newHistoryRef, historyData);

      return true;
    } catch (error) {
      console.error(`Error writing data for ${nodeId}:`, error);
      return false;
    }
  }

  /**
   * Simulates data from all active nodes
   */
  async simulateAllNodes() {
    try {
      // Get all nodes from Firebase
      const nodesSnapshot = await get(ref(database, 'nodes'));
      const nodes = nodesSnapshot.val();

      if (!nodes) {
        console.warn('No nodes found in database. Please register nodes first.');
        return;
      }

      // Update each node
      for (const [nodeId, nodeData] of Object.entries(nodes)) {
        if (!nodeData.realtime) {
          console.warn(`Node ${nodeId} has no realtime data structure`);
          continue;
        }

        const isGateway = nodeData.metadata?.type === 'gateway';
        const newData = this.generateSensorData(nodeData.realtime, isGateway);
        
        await this.writeSensorData(nodeId, newData);
        console.log(`✅ Updated ${nodeId}:`, newData);
      }
    } catch (error) {
      console.error('Error simulating nodes:', error);
    }
  }

  /**
   * Starts continuous simulation (mimics real sensor updates)
   */
  start(intervalSeconds = 10) {
    if (this.isRunning) {
      console.warn('Simulator is already running');
      return;
    }

    console.log(`🚀 Starting data simulator (update every ${intervalSeconds}s)`);
    this.isRunning = true;

    // Run immediately
    this.simulateAllNodes();

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.simulateAllNodes();
    }, intervalSeconds * 1000);
  }

  /**
   * Stops the simulation
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('⏹️ Data simulator stopped');
    }
  }

  /**
   * Generates historical data for testing graphs
   */
  async generateHistoricalData(nodeId, hoursBack = 24, intervalMinutes = 10) {
    try {
      console.log(`Generating ${hoursBack}h of historical data for ${nodeId}...`);
      
      // Get node's base data
      const nodeSnapshot = await get(ref(database, `nodes/${nodeId}`));
      const node = nodeSnapshot.val();
      
      if (!node) {
        console.error(`Node ${nodeId} not found`);
        return;
      }

      const isGateway = node.metadata?.type === 'gateway';
      const baseData = node.realtime;
      const now = Date.now();
      const totalPoints = (hoursBack * 60) / intervalMinutes;
      
      let dataPoints = 0;
      
      for (let i = totalPoints; i >= 0; i--) {
        const timestamp = now - (i * intervalMinutes * 60 * 1000);
        
        // Add some trending (simulate pressure drop over time)
        const pressureTrend = -0.05 * (totalPoints - i);
        const trendedData = {
          ...baseData,
          pressure: baseData.pressure + pressureTrend,
          temperature: baseData.temperature + Math.sin(i / 10) * 2,
          humidity: isGateway ? baseData.humidity + Math.cos(i / 8) * 5 : null
        };
        
        const historicalData = {
          temperature: +(trendedData.temperature + (Math.random() - 0.5) * 2).toFixed(2),
          pressure: +(trendedData.pressure + (Math.random() - 0.5) * 2).toFixed(2),
          altitude: +(baseData.altitude + (Math.random() - 0.5) * 0.5).toFixed(2),
          humidity: isGateway || baseData.humidity ? +(trendedData.humidity + (Math.random() - 0.5) * 3).toFixed(2) : null,
          rainfall: !isGateway ? (Math.random() > 0.8 ? +(Math.random() * 3).toFixed(1) : 0) : null,
          rssi: isGateway ? null : Math.floor((baseData.rssi || -70) + (Math.random() - 0.5) * 10),
          timestamp: Math.floor(timestamp / 1000).toString()  // Unix timestamp in seconds
        };

        await set(ref(database, `nodes/${nodeId}/history/${timestamp}`), historicalData);
        dataPoints++;
        
        // Progress indicator
        if (dataPoints % 20 === 0) {
          console.log(`  Generated ${dataPoints}/${totalPoints} points...`);
        }
      }
      
      console.log(`✅ Generated ${dataPoints} historical data points for ${nodeId}`);
    } catch (error) {
      console.error('Error generating historical data:', error);
    }
  }

  /**
   * Generates historical data for all nodes
   */
  async generateHistoricalDataForAllNodes(hoursBack = 24) {
    try {
      const nodesSnapshot = await get(ref(database, 'nodes'));
      const nodes = nodesSnapshot.val();

      if (!nodes) {
        console.warn('No nodes found in database');
        return;
      }

      for (const nodeId of Object.keys(nodes)) {
        await this.generateHistoricalData(nodeId, hoursBack);
      }
      
      console.log('✅ Historical data generation complete for all nodes!');
    } catch (error) {
      console.error('Error generating historical data:', error);
    }
  }
}

// Create singleton instance
export const dataSimulator = new DataSimulator();

// Helper functions for easy access
export const startSimulation = (intervalSeconds = 10) => {
  dataSimulator.start(intervalSeconds);
};

export const stopSimulation = () => {
  dataSimulator.stop();
};

export const generateHistoricalData = async (nodeId, hoursBack = 24) => {
  await dataSimulator.generateHistoricalData(nodeId, hoursBack);
};

export const generateHistoricalDataForAll = async (hoursBack = 24) => {
  await dataSimulator.generateHistoricalDataForAllNodes(hoursBack);
};

