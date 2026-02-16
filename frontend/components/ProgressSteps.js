import React from 'react';
import { View } from 'react-native';

export default function ProgressSteps({ currentStep }) {
  const steps = [1, 2, 3];

  return (
    <View className="flex-row items-center justify-center px-8 py-6 bg-white">
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          {/* Le Cercle - Plus grand */}
          <View
            className={`w-4 h-4 rounded-full ${
              step <= currentStep ? 'bg-black' : 'bg-gray-200'
            }`}
          />
          
          {/* La Ligne entre les cercles - Prend toute la largeur disponible */}
          {index < steps.length - 1 && (
            <View 
              className={`h-[2px] flex-1 mx-3 ${
                step < currentStep ? 'bg-black' : 'bg-gray-200'
              }`} 
            />
          )}
        </React.Fragment>
      ))}
    </View>
  );
}