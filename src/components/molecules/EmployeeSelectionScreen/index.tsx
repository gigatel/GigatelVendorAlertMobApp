import React, {useEffect, useState} from 'react';
import {View, Text, FlatList, TouchableOpacity, TextInput} from 'react-native';
import {useDispatch} from 'react-redux';
import {getEmployeeDetailsApi} from '@slices/dss.slice';
import styles from './styles'; // 👈 FIXED
import {Screen} from '@organisms';
import {COLORS} from '@res';

const EmployeeSelectionScreen = ({navigation, route}: any) => {
  const dispatch = useDispatch<any>();

  const [list, setList] = useState<any[]>([]);
  const [filteredList, setFilteredList] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const result = await dispatch(getEmployeeDetailsApi());

    if (getEmployeeDetailsApi.fulfilled.match(result)) {
      const data = result.payload || [];
      const formatted = data.map((item: any) => ({
        ...item,
        label: `${item.employeeName} (${item.employeeCode})`,
      }));

      setList(formatted);
      setFilteredList(formatted);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);

    const filtered = list.filter(item =>
      item.employeeName.toLowerCase().includes(text.toLowerCase()),
    );

    setFilteredList(filtered);
  };

  const toggleSelect = (item: any) => {
    const exists = selected.find(i => i.id === item.id);

    if (exists) {
      setSelected(prev => prev.filter(i => i.id !== item.id));
    } else {
      setSelected(prev => [...prev, item]);
    }
  };

  const handleDone = () => {
    route.params?.onSelect(selected);
    navigation.goBack();
  };

  const renderItem = ({item}: any) => {
    const isSelected = selected.some(i => i.id === item.id);

    return (
      <TouchableOpacity style={styles.row} onPress={() => toggleSelect(item)}>
        <View style={styles.info}>
          <Text style={styles.name}>{item.employeeName}</Text>
          <Text style={styles.code}>{item.employeeCode}</Text>
        </View>

        <View style={[styles.checkbox, isSelected && styles.checked]}>
          {isSelected && <Text style={styles.tick}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen statusBarStyle="dark-content" statusBgColor={COLORS.PRIMARY}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>SELECT EMPLOYEES</Text>
          <View style={{width: 24}} />
        </View>

        {/* Search */}
        <TextInput
          placeholder="Search..."
          value={search}
          onChangeText={handleSearch}
          style={styles.search}
        />

        {/* List */}
        <FlatList
          data={filteredList}
          keyExtractor={item => item.id.toString()}
          renderItem={renderItem}
        />

        {/* Button */}
        <TouchableOpacity style={styles.button} onPress={handleDone}>
          <Text style={styles.buttonText}>NEXT</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

export default EmployeeSelectionScreen;
