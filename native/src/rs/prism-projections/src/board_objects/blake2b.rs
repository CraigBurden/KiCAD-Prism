//! BLAKE2b-512 (RFC 7693), unkeyed, for the review-only object ids
//! (`ecad-parse.mjs:252-257`). The workspace has only `sha2`
//! (`prism-kicad-core`), so this is a small, self-contained implementation.
//! No `unsafe`.

const IV: [u64; 8] = [
    0x6a09_e667_f3bc_c908,
    0xbb67_ae85_84ca_a73b,
    0x3c6e_f372_fe94_f82b,
    0xa54f_f53a_5f1d_36f1,
    0x510e_527f_ade6_82d1,
    0x9b05_688c_2b3e_6c1f,
    0x1f83_d9ab_fb41_bd6b,
    0x5be0_cd19_137e_2179,
];

const SIGMA: [[usize; 16]; 12] = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
];

const BLOCK: usize = 128;

struct State {
    h: [u64; 8],
    t: u128,
    buffer: [u8; BLOCK],
    buffered: usize,
}

impl State {
    fn new() -> Self {
        let mut h = IV;
        // Parameter block: digest_length 64, key_length 0, fanout 1, depth 1.
        h[0] ^= 0x0101_0040;
        State {
            h,
            t: 0,
            buffer: [0; BLOCK],
            buffered: 0,
        }
    }

    fn update(&mut self, mut input: &[u8]) {
        while !input.is_empty() {
            if self.buffered == BLOCK {
                self.t += BLOCK as u128;
                let block = self.buffer;
                compress(&mut self.h, &block, self.t, false);
                self.buffered = 0;
            }
            let take = (BLOCK - self.buffered).min(input.len());
            self.buffer[self.buffered..self.buffered + take].copy_from_slice(&input[..take]);
            self.buffered += take;
            input = &input[take..];
        }
    }

    fn finalize(mut self) -> [u8; 64] {
        self.t += self.buffered as u128;
        for byte in &mut self.buffer[self.buffered..] {
            *byte = 0;
        }
        let block = self.buffer;
        compress(&mut self.h, &block, self.t, true);
        let mut out = [0u8; 64];
        for (index, word) in self.h.iter().enumerate() {
            out[index * 8..index * 8 + 8].copy_from_slice(&word.to_le_bytes());
        }
        out
    }
}

fn g(v: &mut [u64; 16], a: usize, b: usize, c: usize, d: usize, x: u64, y: u64) {
    v[a] = v[a].wrapping_add(v[b]).wrapping_add(x);
    v[d] = (v[d] ^ v[a]).rotate_right(32);
    v[c] = v[c].wrapping_add(v[d]);
    v[b] = (v[b] ^ v[c]).rotate_right(24);
    v[a] = v[a].wrapping_add(v[b]).wrapping_add(y);
    v[d] = (v[d] ^ v[a]).rotate_right(16);
    v[c] = v[c].wrapping_add(v[d]);
    v[b] = (v[b] ^ v[c]).rotate_right(63);
}

fn compress(h: &mut [u64; 8], block: &[u8; BLOCK], t: u128, last: bool) {
    let mut m = [0u64; 16];
    for (index, word) in m.iter_mut().enumerate() {
        let mut bytes = [0u8; 8];
        bytes.copy_from_slice(&block[index * 8..index * 8 + 8]);
        *word = u64::from_le_bytes(bytes);
    }
    let mut v = [0u64; 16];
    v[..8].copy_from_slice(h);
    v[8..].copy_from_slice(&IV);
    v[12] ^= t as u64;
    v[13] ^= (t >> 64) as u64;
    if last {
        v[14] = !v[14];
    }
    for s in &SIGMA {
        g(&mut v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
        g(&mut v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
        g(&mut v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
        g(&mut v, 3, 7, 11, 15, m[s[6]], m[s[7]]);
        g(&mut v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
        g(&mut v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
        g(&mut v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
        g(&mut v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }
    for index in 0..8 {
        h[index] ^= v[index] ^ v[index + 8];
    }
}

/// The BLAKE2b-512 digest of `input` (64 bytes).
#[must_use]
pub fn digest512(input: &[u8]) -> [u8; 64] {
    let mut state = State::new();
    state.update(input);
    state.finalize()
}

/// The digest as lowercase hex.
#[must_use]
pub fn hex(input: &[u8]) -> String {
    let bytes = digest512(input);
    let mut out = String::with_capacity(128);
    for byte in bytes {
        out.push(char::from_digit(u32::from(byte >> 4), 16).unwrap_or('0'));
        out.push(char::from_digit(u32::from(byte & 0xf), 16).unwrap_or('0'));
    }
    out
}

#[cfg(test)]
mod tests {
    fn hex_of(input: &[u8]) -> String {
        super::hex(input)
    }

    #[test]
    fn matches_the_reference_vectors() {
        assert_eq!(
            hex_of(b""),
            "786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419\
             d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce"
        );
        assert_eq!(
            hex_of(b"abc"),
            "ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d1\
             7d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923"
        );
    }

    #[test]
    fn matches_the_reference_vectors_for_one_and_two_blocks() {
        let one: Vec<u8> = (0..128).map(|i| (i % 251) as u8).collect();
        assert_eq!(
            hex_of(&one),
            "2319e3789c47e2daa5fe807f61bec2a1a6537fa03f19ff32e87eecbfd64b7e0e\
             8ccff439ac333b040f19b0c4ddd11a61e24ac1fe0f10a039806c5dcc0da3d115"
        );
        let two: Vec<u8> = (0..200).map(|i| (i % 251) as u8).collect();
        assert_eq!(
            hex_of(&two),
            "fb3c1f0f56a56f8e316fdf5d853c8c872c39635d083634c3904fc3ac07d1b578\
             e85ff0e480e92d44ade33b62e893ee32343e79ddf6ef292e89b582d312502314"
        );
    }

    #[test]
    fn the_identity_hash_of_gnd_matches_the_field_map() {
        assert_eq!(&hex_of(b"\"GND\"")[..16], "a9234253d71b2d7e");
    }
}
