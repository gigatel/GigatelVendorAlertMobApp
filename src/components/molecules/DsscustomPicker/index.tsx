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
  labelKey: string;
  onSelect: (item: any) => void;
}
const DssCustomPicker = ({
  data,
  value,
  placeholder,
  labelKey,
  onSelect,
}: Props) => {
  const [visible, setVisible] = useState(false);
  const handleSelect = (item: any) => {
    onSelect(item);
    setVisible(false);
  };
  return (
    <>
      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.inputBox}
        onPress={() => setVisible(true)}>
        <Text style={styles.inputText}>
          {value ? value[labelKey] : placeholder}
        </Text>
      </TouchableOpacity>

      {/* Dropdown Modal */}
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}>
          <View style={styles.dropdown}>
            <FlatList
              data={data}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.item}
                  onPress={() => handleSelect(item)}>
                  <Text style={styles.itemText}>{item[labelKey]}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default DssCustomPicker;

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
  },
});
