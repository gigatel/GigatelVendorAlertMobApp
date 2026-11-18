import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from 'react-native';
import {COLORS, FONTS} from '@res';

interface Props {
  data: any[];
  value: any;
  placeholder: string;
  labelKey: string; // key to DISPLAY in dropdown & after selection
  displayKey?: string; // key to show AFTER selection (optional, falls back to labelKey)
  onSelect: (item: any) => void;
}

const DssCustomPicker2 = ({
  data,
  value,
  placeholder,
  labelKey,
  displayKey,
  onSelect,
}: Props) => {
  const [visible, setVisible] = useState(false);

  const handleSelect = (item: any) => {
    onSelect(item);
    setVisible(false);
  };

  // Show displayKey after selection if provided, else labelKey
  const selectedLabel = value
    ? value[displayKey ?? labelKey] ?? placeholder
    : placeholder;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.inputBox}
        onPress={() => data?.length > 0 && setVisible(true)}>
        <Text
          style={[styles.inputText, !value && {color: '#999'}]}
          numberOfLines={1}>
          {selectedLabel}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View style={styles.dropdown}>
            <FlatList
              data={data}
              keyExtractor={(item, index) =>
                item?.id?.toString() ?? index.toString()
              }
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => handleSelect(item)}>
                  {/* Show name in dropdown list */}
                  <Text style={styles.itemText}>{item[labelKey]}</Text>
                  {/* Optionally show id as subtitle */}
                  {item?.id && item?.id !== item[labelKey] && (
                    <Text style={styles.itemSubText}>{item.id}</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default DssCustomPicker2;

const styles = StyleSheet.create({
  inputBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E6EEF6',
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 36,
    justifyContent: 'center',
    backgroundColor: '#F7F9FB',
  },
  inputText: {
    fontSize: 13,
    fontFamily: FONTS.MEDIUM,
    color: '#2F4F4F',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  dropdown: {
    backgroundColor: 'white',
    borderRadius: 8,
    maxHeight: 300,
  },
  item: {
    padding: 14,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  itemText: {
    fontSize: 14,
    fontFamily: FONTS.MEDIUM,
    color: '#2F4F4F',
  },
  itemSubText: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
