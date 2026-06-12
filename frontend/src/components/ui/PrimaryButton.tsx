import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const isDisabled = disabled || loading;

  const getButtonContent = () => {
    const iconColor =
      variant === 'secondary' ? '#0f0f1a' : '#ffffff';
    const textColor: TextStyle =
      variant === 'secondary'
        ? { color: '#0f0f1a' }
        : variant === 'ghost'
        ? { color: '#e94560' }
        : { color: '#ffffff' };

    return (
      <View style={styles.contentRow}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'secondary' ? '#0f0f1a' : '#ffffff'}
          />
        ) : (
          <>
            {icon && (
              <Ionicons
                name={icon}
                size={18}
                color={variant === 'ghost' ? '#e94560' : iconColor}
                style={styles.icon}
              />
            )}
            <Text style={[styles.buttonText, textColor]}>{title}</Text>
          </>
        )}
      </View>
    );
  };

  const containerStyle: ViewStyle[] = [
    styles.base,
    fullWidth ? styles.fullWidth : {},
    isDisabled ? styles.disabled : {},
  ];

  const shadowStyle: ViewStyle =
    variant === 'primary'
      ? {
          shadowColor: '#e94560',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 8,
        }
      : variant === 'secondary'
      ? {
          shadowColor: '#64ffda',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 8,
          elevation: 8,
        }
      : {};

  if (variant === 'primary') {
    return (
      <Animated.View
        style={[containerStyle, shadowStyle, { transform: [{ scale: scaleAnim }] }]}
      >
        <Pressable
          onPress={isDisabled ? undefined : onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.pressable}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <LinearGradient
            colors={['#e94560', '#c0392b']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >
            {getButtonContent()}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'secondary') {
    return (
      <Animated.View
        style={[containerStyle, shadowStyle, { transform: [{ scale: scaleAnim }] }]}
      >
        <Pressable
          onPress={isDisabled ? undefined : onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.pressable}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <LinearGradient
            colors={['#64ffda', '#00b894']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >
            {getButtonContent()}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'danger') {
    return (
      <Animated.View
        style={[
          containerStyle,
          styles.dangerBg,
          {
            transform: [{ scale: scaleAnim }],
            shadowColor: '#e74c3c',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
          },
        ]}
      >
        <Pressable
          onPress={isDisabled ? undefined : onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.pressable}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          {getButtonContent()}
        </Pressable>
      </Animated.View>
    );
  }

  // ghost
  return (
    <Animated.View
      style={[containerStyle, styles.ghostBorder, { transform: [{ scale: scaleAnim }] }]}
    >
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {getButtonContent()}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },
  pressable: {
    flex: 1,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  icon: {
    marginRight: 8,
  },
  dangerBg: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBorder: {
    borderWidth: 1.5,
    borderColor: '#e94560',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PrimaryButton;
