/* Independent, read-only APK v2 verifier using only the Java standard library.
 * Follows https://source.android.com/docs/security/features/apksigning/v2.
 * This is not Android PackageManager, nor a substitute for installation testing.
 */
import java.nio.*;
import java.nio.file.*;
import java.security.*;
import java.security.cert.*;
import java.security.spec.*;
import java.io.*;
import java.util.*;

public final class VerifyApkV2 {
  static void require(boolean b, String why) { if (!b) throw new IllegalArgumentException(why); }
  static ByteBuffer buf(byte[] b) { return ByteBuffer.wrap(b).order(ByteOrder.LITTLE_ENDIAN); }
  static ByteBuffer slice(ByteBuffer b, int n) {
    require(n>=0 && n<=b.remaining(),"Invalid length prefix");
    ByteBuffer v=b.slice().order(ByteOrder.LITTLE_ENDIAN);v.limit(n);b.position(b.position()+n);return v;
  }
  static ByteBuffer lp(ByteBuffer b) {require(b.remaining()>=4,"Missing length");return slice(b,b.getInt());}
  static byte[] bytes(ByteBuffer b) {byte[] a=new byte[b.remaining()];b.get(a);return a;}
  static byte[] little(int n) {return ByteBuffer.allocate(4).order(ByteOrder.LITTLE_ENDIAN).putInt(n).array();}
  static byte[] digest(byte[][] sections) throws Exception {
    List<byte[]> chunkDigests=new ArrayList<>();
    for(byte[] section:sections) for(int p=0;p<section.length;p+=1048576){
      int n=Math.min(1048576,section.length-p);
      MessageDigest md=MessageDigest.getInstance("SHA-256");md.update((byte)0xa5);md.update(little(n));md.update(section,p,n);chunkDigests.add(md.digest());
    }
    MessageDigest md=MessageDigest.getInstance("SHA-256");md.update((byte)0x5a);md.update(little(chunkDigests.size()));
    for(byte[] d:chunkDigests) md.update(d);
    return md.digest();
  }
  public static void main(String[] args) throws Exception {
    require(args.length==1,"Usage: VerifyApkV2 file.apk");byte[] apk=Files.readAllBytes(Path.of(args[0]));ByteBuffer all=buf(apk);
    int end=-1;
    for(int p=apk.length-22;p>=Math.max(0,apk.length-65557);p--)
      if(all.getInt(p)==0x06054b50 && p+22+Short.toUnsignedInt(all.getShort(p+20))==apk.length){end=p;break;}
    require(end>=0,"EOCD missing");require(all.getShort(end+4)==0&&all.getShort(end+6)==0,"Multi-disk ZIP forbidden");
    int cd=all.getInt(end+16),cdSize=all.getInt(end+12);
    require(cd>32&&cdSize>=0&&cd+cdSize==end,"ZIP directory not contiguous with EOCD");
    require(Arrays.equals(Arrays.copyOfRange(apk,cd-16,cd),"APK Sig Block 42".getBytes(java.nio.charset.StandardCharsets.US_ASCII)),"Signing block magic missing");
    long size=all.getLong(cd-24);require(size>=24&&size<Integer.MAX_VALUE,"Bad signing block size");
    int start=cd-(int)size-8;require(start>=0&&all.getLong(start)==size,"Signing block sizes differ");
    ByteBuffer pairs=buf(Arrays.copyOfRange(apk,start+8,cd-24));ByteBuffer v2=null;
    while(pairs.hasRemaining()){
      require(pairs.remaining()>=8,"Truncated ID/value");long length=pairs.getLong();require(length>=4&&length<=pairs.remaining(),"Invalid ID/value length");
      ByteBuffer pair=slice(pairs,(int)length);int id=pair.getInt();if(id==0x7109871a){require(v2==null,"Duplicate v2 block");v2=pair;}
    }
    require(v2!=null,"No v2 signature");ByteBuffer signers=lp(v2);require(!v2.hasRemaining(),"Trailing v2 data");
    int count=0;
    while(signers.hasRemaining()){
      ByteBuffer signer=lp(signers);byte[] signedData=bytes(lp(signer));ByteBuffer signatures=lp(signer);byte[] publicDer=bytes(lp(signer));
      require(!signer.hasRemaining(),"Trailing signer fields");
      List<Integer> algorithms=new ArrayList<>();byte[] signature=null;
      while(signatures.hasRemaining()){
        ByteBuffer record=lp(signatures);int id=record.getInt();byte[] sig=bytes(lp(record));require(!record.hasRemaining(),"Trailing signature data");algorithms.add(id);
        if(id==0x103)signature=sig;
      }
      require(signature!=null&&algorithms.equals(List.of(0x103)),"Unexpected signature algorithms");
      PublicKey pub=KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(publicDer));
      Signature sig=Signature.getInstance("SHA256withRSA");sig.initVerify(pub);sig.update(signedData);require(sig.verify(signature),"RSA signature invalid");
      ByteBuffer sd=buf(signedData),digests=lp(sd),certs=lp(sd),attrs=lp(sd);require(!sd.hasRemaining(),"Trailing signed data");
      ByteBuffer digestRecord=lp(digests);require(!digests.hasRemaining(),"Unexpected multiple digests");require(digestRecord.getInt()==0x103,"Digest algorithm mismatch");byte[] expected=bytes(lp(digestRecord));require(!digestRecord.hasRemaining(),"Trailing digest fields");
      X509Certificate cert=(X509Certificate)CertificateFactory.getInstance("X.509").generateCertificate(new ByteArrayInputStream(bytes(lp(certs))));
      require(!certs.hasRemaining(),"Unexpected extra certificates");require(Arrays.equals(cert.getPublicKey().getEncoded(),publicDer),"Certificate/public-key mismatch");
      cert.verify(pub);cert.checkValidity();require(!attrs.hasRemaining(),"Unexpected signed attributes");
      byte[] eocd=Arrays.copyOfRange(apk,end,apk.length);buf(eocd).putInt(16,start);
      byte[] actual=digest(new byte[][]{Arrays.copyOfRange(apk,0,start),Arrays.copyOfRange(apk,cd,end),eocd});
      require(MessageDigest.isEqual(expected,actual),"APK content digest mismatch");
      System.out.println("PASS: v2 RSA/SHA-256 signature, APK content digest, signer certificate and block structure");
      System.out.println("Certificate SHA-256: "+HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(cert.getEncoded())));count++;
    }
    require(count==1,"Expected exactly one signer");System.out.println("PASS: "+count+" signer; APK Signature Scheme v2 independently verified");
  }
}
