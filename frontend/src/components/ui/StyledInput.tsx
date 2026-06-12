import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardTypeOptions,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StyledInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
}

const StyledInput: React.FC<StyledInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  icon,
  style,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const borderColorAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.timing(borderColorAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.timing(borderColorAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [error ? '#e74c3c' : '#2d2d4e', error ? '#e74c3c' : '#e94560'],
  });

  const shadowOpacity = borderColorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View
        style={[
          styles.inputWrapper,
          {
            borderColor: error ? '#e74c3c' : borderColor,
            shadowColor: error ? '#e74c3c' : '#e94560',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isFocused ? 0.4 : 0,
            shadowRadius: 8,
            elevation: isFocused ? 4 : 0,
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={isFocused ? '#e94560' : '#8892b0'}
            style={styles.iconLeft}
          />
        )}
        <TextInput
          style={[styles.input, icon ? styles.inputWithIcon : null]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#4a4a6a"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={handleFocus}
          onBlur={handleBlur}
          selectionColor="#e94560"
          autoCapitalize="none"
        />
      </Animated.View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8892b0',
    marginBottom: 8,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  iconLeft: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#ccd6f6',
    fontSize: 15,
    fontWeight: '400',
  },
  inputWithIcon: {
    paddingLeft: 4,
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#e74c3c',
    fontWeight: '500',
  },
});

export default StyledInput;
