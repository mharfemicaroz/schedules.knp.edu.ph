import React from 'react';
import { InputGroup, InputLeftElement, Input } from '@chakra-ui/react';
import { FiSearch } from 'react-icons/fi';
import { useDispatch } from 'react-redux';
import { setQuery } from '../store/dataSlice';
import useDebounce from '../hooks/useDebounce';

export default function SearchBar() {
  const dispatch = useDispatch();
  const [value, setValue] = React.useState('');
  const debounced = useDebounce(value, 200);

  React.useEffect(() => {
    dispatch(setQuery(debounced));
  }, [debounced, dispatch]);

  return (
    <InputGroup maxW={{ base: '100%', md: '360px' }}>
      <InputLeftElement pointerEvents="none">
        <FiSearch />
      </InputLeftElement>
      <Input value={value} onChange={e => setValue(e.target.value)} placeholder="Search faculty, email, department..." rounded="md" />
    </InputGroup>
  );
}
