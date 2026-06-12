import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  colors?: string[];
  glowColor?: string;
}

const GradientCard: React.FC<GradientCardProps> = ({
  children,
  style,
  colors = ['#1a1a2e', '#16213e'],
  glowColor,
}) => {
  return (
    <View
      style={[
        styles.outerWrapper,
        glowColor
          ? {
              shadowColor: glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.75,
              shadowRadius: 12,
              elevation: 12,
            }
          : styles.defaultShadow,
        style,
      ]}
    >
      {glowColor && (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            styles.glowBorder,
            { borderColor: glowColor },
          ]}
          pointerEvents="none"
        />
      )}
      <LinearGradient
        colors={colors as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  defaultShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  glowBorder: {
    borderRadius: 14,
    borderWidth: 1.5,
    zIndex: 10,
  },
  gradient: {
    borderRadius: 14,
    overflow: 'hidden',
  },
});

export default GradientCard;
