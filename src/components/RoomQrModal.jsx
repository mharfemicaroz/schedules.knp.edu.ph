import React from 'react';
import { Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter, Button, VStack, Text, HStack, Input, Image, useClipboard, useColorModeValue } from '@chakra-ui/react';
import { printContent } from '../utils/printDesign';

function buildQrUrl(data, size = 240) {
  const s = Math.max(120, Math.min(720, size | 0));
  const encoded = encodeURIComponent(String(data || ''));
  // Using public QR server to generate PNG
  return `https://api.qrserver.com/v1/create-qr-code/?size=${s}x${s}&data=${encoded}`;
}

export default function RoomQrModal({ isOpen, onClose, url, room }) {
  const border = useColorModeValue('gray.200','gray.700');
  const { hasCopied, onCopy } = useClipboard(String(url || ''));
  const qr = buildQrUrl(url);
  const printQr = () => {
    const title = `Room Schedule QR`;
    const subtitle = `Room: ${room || '-'}`;
    const bodyHtml = `
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;">
        <div style="flex:0 0 auto;border:1px solid #d1d5db;border-radius:10px;padding:10px;">
          <img src="${qr}" alt="Room QR Code" style="width:280px;height:auto;" />
        </div>
        <div style="flex:1 1 320px;">
          <p style="margin:0 0 6px 0;font-size:18px;font-weight:800;">Hey, KNPian! 👋</p>
          <p style="margin:0 0 12px 0;font-size:14px;">Scan the QR to see who’s in this room right now.</p>
          <div style="font-size:12px;border:1px dashed #9ca3af;padding:8px;border-radius:6px;word-break:break-all;">${url || ''}</div>
          <p style="margin:6px 0 0 0;font-size:12px;color:#6b7280;">If the QR doesn’t work, open the link above.</p>
        </div>
      </div>
    `;
    printContent({ title, subtitle, bodyHtml }, { pageSize: 'A4', orientation: 'portrait', margin: '14mm' });
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Room QR Code{room ? `: ${room}` : ''}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="center">
            <Image src={qr} alt="Room QR Code" borderWidth="1px" borderColor={border} rounded="md" />
            <Text fontSize="sm" color={useColorModeValue('gray.700','gray.300')}>
              Hey, KNPian! Scan this to see who&apos;s here now.
            </Text>
            <HStack w="full" spacing={2}>
              <Input value={url || ''} isReadOnly size="sm" />
              <Button size="sm" onClick={onCopy}>{hasCopied ? 'Copied' : 'Copy'}</Button>
            </HStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={printQr} colorScheme="blue" mr={3}>Print</Button>
          <Button onClick={onClose} variant="ghost">Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
