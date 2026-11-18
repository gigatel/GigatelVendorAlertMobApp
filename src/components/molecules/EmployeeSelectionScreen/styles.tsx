import {COLORS} from '@res';
import {StyleSheet} from 'react-native';

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},

  header: {
    height: 60,
    backgroundColor: COLORS.PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },

  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  back: {
    fontSize: 20,
    color: '#fff',
  },

  search: {
    margin: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },

  row: {
    flexDirection: 'row',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },

  info: {flex: 1},

  name: {
    fontSize: 14,
    fontWeight: '500',
  },

  code: {
    fontSize: 12,
    color: 'red',
  },

  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: '#999',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checked: {
    backgroundColor: '#2F5BFF',
    borderColor: '#2F5BFF',
  },

  tick: {
    color: '#fff',
    fontSize: 14,
  },

  button: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
  },

  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});
export default styles;
