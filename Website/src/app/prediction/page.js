// src/app/prediction/page.js
'use client';

import { useState, useEffect } from 'react';
import { CloudRain, TrendingUp, Calendar, MapPin, Droplets, Wind, Thermometer, AlertTriangle } from 'lucide-react';

export default function Prediction() {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [predictionDate, setPredictionDate] = useState('');

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/predict');
      const data = await response.json();
      
      if (data.success) {
        setPredictions(data.predictions);
        setPredictionDate(data.date);
      } else {
        setError(data.error || 'Failed to fetch predictions');
      }
    } catch (err) {
      setError('Failed to connect to prediction service');
      console.error('Prediction fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (prediction) => {
    if (prediction >= 0.7) return { level: 'High', color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-500' };
    if (prediction >= 0.4) return { level: 'Medium', color: 'yellow', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-500' };
    return { level: 'Low', color: 'green', bgColor: 'bg-green-50', borderColor: 'border-green-500' };
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400 text-lg">Generating predictions...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-8 text-center">
            <AlertTriangle className="h-16 w-16 text-red-600 dark:text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-200 mb-2">Prediction Error</h2>
            <p className="text-red-700 dark:text-red-300">{error}</p>
            <button
              onClick={fetchPredictions}
              className="mt-4 bg-red-600 dark:bg-red-700 text-white px-6 py-2 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-600 dark:bg-blue-500 p-3 rounded-lg">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Cloudburst Predictions</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">AI-powered weather predictions using XGBoost model</p>
            </div>
          </div>

          {predictionDate && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 inline-flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Predictions for:</span>
                <p className="font-semibold text-gray-900 dark:text-white">{formatDate(predictionDate)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">High Risk Areas</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {predictions.filter(p => p.prediction >= 0.7).length}
                </p>
              </div>
              <AlertTriangle className="h-12 w-12 text-red-400 dark:text-red-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Medium Risk Areas</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
                  {predictions.filter(p => p.prediction >= 0.4 && p.prediction < 0.7).length}
                </p>
              </div>
              <CloudRain className="h-12 w-12 text-yellow-400 dark:text-yellow-500" />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Low Risk Areas</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {predictions.filter(p => p.prediction < 0.4).length}
                </p>
              </div>
              <CloudRain className="h-12 w-12 text-green-400 dark:text-green-500" />
            </div>
          </div>
        </div>

        {/* Predictions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {predictions.map((pred) => {
            const risk = getRiskLevel(pred.prediction);
            return (
              <div
                key={pred.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-l-4 ${risk.borderColor} dark:border-opacity-80 hover:shadow-xl transition-shadow`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${risk.bgColor} dark:bg-opacity-20`}>
                      <CloudRain className={`h-6 w-6 text-${risk.color}-600 dark:text-${risk.color}-400`} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">Area #{pred.id}</h3>
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin className="h-4 w-4" />
                        <span>{pred.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    risk.level === 'High' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                    risk.level === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                    'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                  }`}>
                    {risk.level} Risk
                  </div>
                </div>

                {/* Prediction Classification */}
                <div className="mb-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Cloudburst Classification</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">AI Model Prediction</p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg font-bold text-xl ${
                      pred.prediction >= 0.7 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      pred.prediction >= 0.4 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {pred.prediction >= 0.5 ? 'YES' : 'NO'}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    Model Confidence: {(pred.confidence * 100).toFixed(1)}%
                  </p>
                </div>

                {/* Weather Details */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Temperature</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pred.minTemp.toFixed(1)}° - {pred.maxTemp.toFixed(1)}°C
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Rainfall</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pred.rainfall.toFixed(1)} mm
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Wind Speed</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pred.windGustSpeed.toFixed(1)} km/h
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Humidity</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {pred.humidity3pm.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning Message for High Risk */}
                {risk.level === 'High' && (
                  <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-900 dark:text-red-200">High Risk Alert</p>
                        <p className="text-xs text-red-700 dark:text-red-300">
                          Prepare for potential cloudburst. Monitor weather updates closely.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">About These Predictions</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                These predictions are generated using an XGBoost machine learning model trained on historical weather data
                for Jaynagar region. The model analyzes patterns in temperature, rainfall, humidity, wind speed, and
                atmospheric pressure to classify whether a cloudburst event is likely (YES/NO) for the next day (October 5th, 2025).
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                <span className="font-medium">Note:</span> The classification is binary (YES or NO) based on the model&apos;s
                analysis of weather conditions. Risk levels (High/Medium/Low) are determined by the model&apos;s confidence scores.
                In a production environment, real-time weather data from Jaynagar would be used for predictions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

